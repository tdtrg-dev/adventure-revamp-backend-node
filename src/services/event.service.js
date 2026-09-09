const Event = require('../models/Event');
const EventReview = require('../models/EventReview');
const EventVisit = require('../models/EventVisit');
const TicketBooking = require('../models/TicketBooking');
const TicketCategory = require('../models/TicketCategory');
const User = require('../models/User');
const Group = require('../models/Group');
const Conversation = require('../models/Conversation');
const { notifyUser } = require('./notification.service');
const { haversineDistanceKm, distanceFromPointToLineSegment } = require('../utils/geo');
const { relativeUploadPath, fileUrl } = require('../middlewares/upload');
const ticketmaster = require('../integrations/ticketmaster');
const ttlCache = require('../utils/ttlCache');
const env = require('../config/env');

const HOME_LIST_LIMIT = 10;
const CANDIDATE_CAP = 500; // soft safeguard where Laravel relied on SQL to sort+limit in one query

function notFound(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

async function getUserRadius(userId) {
  const user = await User.findById(userId).select('profile.radius');
  const r = user?.profile?.radius;
  return r && r > 0 ? r : 10;
}

function priceDisplay(price) {
  return price !== null && price !== undefined && price > 0 ? Number(price).toFixed(2) : 'Free';
}

function minPrice(prices) {
  const active = (prices || []).filter((p) => !p.deleted_at);
  if (active.length === 0) return null;
  return Math.min(...active.map((p) => p.price));
}

function firstImagePath(media) {
  return media && media.length ? media[0].file_path : null;
}

// Mirrors Event's Laravel cast ('date:Y-m-d') — list/summary payloads show a bare
// date, not the full Mongoose Date's ISO timestamp.
function dateOnly(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

// ── Batch "join" helpers (mirrors formatSingleEvent's eager-loaded aggregates) ──

async function reviewStatsFor(eventIds) {
  const rows = await EventReview.aggregate([
    { $match: { event_id: { $in: eventIds }, is_approved: true, deleted_at: null } },
    { $group: { _id: '$event_id', avg_rating: { $avg: '$rating' }, review_count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { avg_rating: Math.round(r.avg_rating * 10) / 10, review_count: r.review_count }]));
}

async function visitStatsFor(eventIds) {
  const rows = await EventVisit.aggregate([
    { $match: { event_id: { $in: eventIds } } },
    { $group: { _id: '$event_id', total_visits: { $sum: '$visit_count' }, unique_visitors: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { total_visits: r.total_visits, unique_visitors: r.unique_visitors }]));
}

function formatSingleEvent(event, { reviewStats, visitStats, favouriteEventIds, distanceKm, interestMatchCount } = {}) {
  const rs = reviewStats?.get(String(event._id));
  const vs = visitStats?.get(String(event._id));
  const isFav = favouriteEventIds ? favouriteEventIds.has(String(event._id)) : false;

  const out = {
    event_id: event.id,
    source: 'db',
    external_id: null,
    booking_url: null,
    event_name: event.trip_name,
    event_image: firstImagePath(event.media),
    start_date: dateOnly(event.start_date),
    end_date: dateOnly(event.end_date),
    location: event.location_name,
    location_lat: event.location_lat,
    location_long: event.location_long,
    distance_km: distanceKm !== undefined && distanceKm !== null ? Math.round(distanceKm) : null,
    starting_price: priceDisplay(minPrice(event.prices)),
    rating: { avg: rs ? rs.avg_rating : 0, count: rs ? rs.review_count : 0 },
    interests: (event.interests || []).map((i) => ({ id: i.id, title: i.title })),
    // was a separate event_favourites row id — with favourites now embedded on the
    // event, event_id doubles as the reference id for toggle/lookup purposes.
    is_favt: isFav,
    favt_id: isFav ? event.id : null,
  };

  if (vs) {
    out.total_visits = vs.total_visits;
    out.unique_visitors = vs.unique_visitors;
  }
  if (interestMatchCount !== undefined) {
    out.interest_match_count = interestMatchCount;
  }

  return out;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

async function createOrUpdateEvent(body, id, files) {
  const eventData = {
    trip_name: body.trip_name,
    start_date: body.start_date,
    end_date: body.end_date,
    location_name: body.location_name,
    location_lat: body.latitude ?? null,
    location_long: body.longitude ?? null,
    description: body.description,
    website_link: body.link || null,
    organizer_id: body.organizer_id,
    status: 'publish',
  };
  if (body.latitude !== undefined && body.longitude !== undefined) {
    eventData.location = { type: 'Point', coordinates: [Number(body.longitude), Number(body.latitude)] };
  }

  let event;
  const isNew = !id;
  if (isNew) {
    event = new Event(eventData);
  } else {
    event = await Event.findById(id);
    if (!event) throw notFound('Event not found.');
    Object.assign(event, eventData);
  }

  const thumbnailFile = files?.thumbnail?.[0];
  if (thumbnailFile) {
    event.image_thumbnail = relativeUploadPath('events/thumbnails', thumbnailFile.filename);
  }

  if (!isNew) {
    const keepIds = (body.keep_image_ids || []).map(String);
    event.media = keepIds.length ? event.media.filter((m) => keepIds.includes(String(m._id))) : event.media;
  }

  const eventImageFiles = files?.event_images || [];
  if (eventImageFiles.length) {
    eventImageFiles.forEach((f) => {
      event.media.push({ file_path: relativeUploadPath('events/images', f.filename), file_type: 'image' });
    });
  }

  if (body.gear_icons !== undefined) {
    const gearIcons = (Array.isArray(body.gear_icons) ? body.gear_icons : [body.gear_icons]).map((g) => String(g).trim()).filter(Boolean);
    event.gears = gearIcons;
  }

  if (body.selectedInterest !== undefined) {
    event.interests = Array.isArray(body.selectedInterest) ? body.selectedInterest : [body.selectedInterest];
  }

  if (body.event_date) {
    const dates = Array.isArray(body.event_date) ? body.event_date : [body.event_date];
    const descriptions = Array.isArray(body.event_description) ? body.event_description : [body.event_description];
    event.details = dates
      .map((date, i) => (date ? { event_date: date, description: descriptions[i] || '' } : null))
      .filter(Boolean);
  }

  if (body.ticket_cat_id !== undefined) {
    const catIds = Array.isArray(body.ticket_cat_id) ? body.ticket_cat_id : [body.ticket_cat_id];
    const prices = Array.isArray(body.ticket_price) ? body.ticket_price : [body.ticket_price];
    const quantities = Array.isArray(body.ticket_quantity) ? body.ticket_quantity : [body.ticket_quantity];

    event.prices = catIds.map((catId, i) => {
      const qty = Number(quantities[i] || 0);
      return {
        ticket_cat_id: catId,
        price: Number(prices[i] || 0),
        ticket_quantity: qty,
        is_unlimited_tickets: qty === 0 ? 'yes' : 'no',
      };
    });
  }

  await event.save();
  await event.populate([{ path: 'interests', select: 'title' }]);

  if (isNew) {
    createEventGroup(event).catch((e) => console.error('CreateEventGroupJob failed:', e.message));
  }

  return { event, message: isNew ? 'Event created successfully' : 'Event updated successfully' };
}

async function createEventGroup(event) {
  const existing = await Group.findOne({ event_id: event._id, group_type: 'event' });
  if (existing) return;

  const group = await Group.create({
    user_id: event.organizer_id,
    group_type: 'event',
    event_id: event._id,
    title: event.trip_name,
    description: event.description,
    visibility: 'Public',
    group_photo: event.image_thumbnail,
    members: [{ user_id: event.organizer_id, status: 'approved', member_type: 'admin' }],
  });

  await Conversation.create({
    is_group: true,
    name: group.title,
    group_id: group._id,
    participants: [{ user_id: event.organizer_id }],
  });
}

async function cancelEvent(eventId, organizerId) {
  const event = await Event.findOne({ _id: eventId, deleted_at: null });
  if (!event) throw notFound('Event not found.');
  if (String(event.organizer_id) !== String(organizerId)) throw notFound('You are not authorised to cancel this event.');
  if (event.status === 'cancel') throw notFound('Event is already cancelled.');

  const hoursUntilStart = (event.start_date.getTime() - Date.now()) / 3600000;
  if (hoursUntilStart < 24) {
    throw notFound('Event cannot be cancelled within 24 hours of the start date.');
  }

  event.status = 'cancel';
  await event.save();

  const bookings = await TicketBooking.find({ event_id: eventId, status: { $in: ['confirmed', 'pending'] }, deleted_at: null });
  const now = new Date();

  for (const booking of bookings) {
    booking.status = 'cancelled';
    booking.cancelled_at = now;
    booking.cancelled_reason = 'Event cancelled by organiser.';
    await booking.save();

    await notifyUser(
      booking.user_id,
      'event_cancelled',
      { event_id: eventId, event_name: event.trip_name, booking_id: booking.id, invoice: booking.invoice_number },
      { actorId: organizerId, relatedType: 'Event', relatedId: eventId, title: 'Event Cancelled', body: `The event "${event.trip_name}" has been cancelled by the organiser.` }
    );
    // Cancellation email dispatch happens in the Bookings module once it's wired up.
  }

  return { event_id: eventId, status: 'cancel', bookings_affected: bookings.length };
}

async function deleteEvent(id) {
  const event = await Event.findById(id);
  if (!event) throw notFound('Event not found.');
  await Event.deleteOne({ _id: id });
}

async function changeStatus(eventId, status) {
  const event = await Event.findById(eventId);
  if (!event) throw notFound('Event not found.');
  event.status = status;
  await event.save();
  return { event_id: event.id, status: event.status };
}

async function findEventById(id) {
  const event = await Event.findById(id)
    .populate('interests', 'title')
    .populate({ path: 'organizer_id', select: 'name profile.image' });

  if (!event) throw notFound('Event not found.', 404);

  return {
    id: event.id,
    trip_name: event.trip_name,
    start_date: event.start_date.toISOString().slice(0, 10),
    end_date: event.end_date.toISOString().slice(0, 10),
    organizer_id: event.organizer_id?.id,
    latitude: event.location_lat,
    longitude: event.location_long,
    location_name: event.location_name,
    description: event.description,
    link: event.website_link,
    image_thumbnail: event.image_thumbnail,
    organizer: {
      id: event.organizer_id?.id,
      name: event.organizer_id?.name,
      image: event.organizer_id?.profile?.image ? fileUrl(event.organizer_id.profile.image) : null,
    },
    gear_icons: event.gears,
    event_images: event.media.map((m) => ({ id: m._id.toString(), file_path: m.file_path })),
    selectedInterest: event.interests.map((i) => ({ id: i.id, title: i.title })),
    event_details: event.details.map((d) => ({ id: d._id.toString(), event_date: dateOnly(d.event_date), description: d.description })),
    ticket_pricing: event.prices.map((p) => ({
      id: p._id.toString(),
      ticket_cat_id: p.ticket_cat_id,
      price: p.price,
      is_free: p.price === 0,
      ticket_quantity: p.ticket_quantity,
      is_unlimited: p.is_unlimited_tickets === 'yes',
    })),
  };
}

async function trackVisit(eventId, userId, ip, userAgent) {
  await EventVisit.findOneAndUpdate(
    { event_id: eventId, user_id: userId },
    { $inc: { visit_count: 1 }, $set: { last_visited_at: new Date(), ip_address: ip, user_agent: userAgent } },
    { upsert: true, setDefaultsOnInsert: true }
  );

  const totalVisits = await EventVisit.countDocuments({ event_id: eventId });
  return { event_id: eventId, total_visits: totalVisits };
}

async function saveReview(eventId, userId, rating, review) {
  const existing = await EventReview.findOne({ event_id: eventId, user_id: userId });
  const wasCreated = !existing;

  const reviewRecord = await EventReview.findOneAndUpdate(
    { event_id: eventId, user_id: userId },
    { rating, review: review || null },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const stats = await EventReview.aggregate([
    { $match: { event_id: reviewRecord.event_id, is_approved: true, deleted_at: null } },
    { $group: { _id: null, total_reviews: { $sum: 1 }, avg_rating: { $avg: '$rating' } } },
  ]);
  const { total_reviews = 0, avg_rating = 0 } = stats[0] || {};

  return {
    review_id: reviewRecord.id,
    event_id: eventId,
    rating: reviewRecord.rating,
    review: reviewRecord.review,
    is_update: !wasCreated,
    total_reviews,
    avg_rating: Math.round(avg_rating * 10) / 10,
    _message: wasCreated ? 'Review submitted.' : 'Review updated.',
  };
}

async function getEventReviews(eventId, page = 1) {
  if (!(await Event.exists({ _id: eventId, deleted_at: null }))) {
    throw notFound('Event not found.');
  }

  const perPage = 10;
  const match = { event_id: new (require('mongoose').Types.ObjectId)(eventId), is_approved: true, deleted_at: null };

  const [stats] = await EventReview.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total_reviews: { $sum: 1 },
        avg_rating: { $avg: '$rating' },
        five_star: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        four_star: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        three_star: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        two_star: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        one_star: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
      },
    },
  ]);

  const total = stats?.total_reviews || 0;
  const reviews = await EventReview.find({ event_id: eventId, is_approved: true, deleted_at: null })
    .populate('user_id', 'name')
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  return {
    summary: {
      total_reviews: total,
      avg_rating: stats ? Math.round(stats.avg_rating * 10) / 10 : 0,
      breakdown: {
        5: stats?.five_star || 0,
        4: stats?.four_star || 0,
        3: stats?.three_star || 0,
        2: stats?.two_star || 0,
        1: stats?.one_star || 0,
      },
    },
    reviews: reviews.map((r) => ({
      review_id: r.id,
      user_id: r.user_id?.id,
      user_name: r.user_id?.name,
      rating: r.rating,
      review: r.review,
      reviewed_at: r.created_at.toISOString().replace('T', ' ').slice(0, 19),
    })),
    pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) },
  };
}

async function getEventPrices(eventId) {
  const event = await Event.findById(eventId).select('prices');
  if (!event) throw notFound('Event not found.');

  const catIds = event.prices.map((p) => p.ticket_cat_id);
  const categories = await TicketCategory.find({ _id: { $in: catIds } }).select('title');
  const catMap = new Map(categories.map((c) => [String(c._id), c.title]));

  return event.prices.map((p) => ({
    id: p._id.toString(),
    ticketCategoryName: catMap.get(String(p.ticket_cat_id)) || null,
    price: p.price,
    is_free: p.price === 0,
    display_price: p.price === 0 ? 'Free' : p.price.toFixed(2),
    ticket_quantity: p.ticket_quantity,
    is_unlimited: p.is_unlimited_tickets === 'yes',
    display_quantity: p.is_unlimited_tickets === 'yes' ? 'Unlimited' : p.ticket_quantity,
  }));
}

async function toggleFavourite(userId, eventId) {
  const event = await Event.findById(eventId);
  if (!event) throw notFound('Event not found.');

  const idx = event.favourited_by.findIndex((id) => String(id) === String(userId));
  if (idx >= 0) {
    event.favourited_by.splice(idx, 1);
    await event.save();
    return { is_favourite: false, event_id: eventId, _message: 'Event removed from favourites.' };
  }

  event.favourited_by.push(userId);
  await event.save();
  return { is_favourite: true, event_id: eventId, _message: 'Event added to favourites.' };
}

async function getUserFavourites(userId, page = 1) {
  const perPage = 15;
  const query = { favourited_by: userId, deleted_at: null };

  const total = await Event.countDocuments(query);
  const events = await Event.find(query)
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  const data = events.map((e) => ({
    favourite_id: e.id,
    favourited_at: e.updated_at,
    event_id: e.id,
    event_name: e.trip_name,
    event_image: firstImagePath(e.media),
    start_date: dateOnly(e.start_date),
    end_date: dateOnly(e.end_date),
    location: e.location_name,
    status: e.status,
    starting_price: priceDisplay(minPrice(e.prices)),
  }));

  return { data, pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) } };
}

async function getOrganizerEvents(organizerId, page = 1) {
  const perPage = 15;
  const query = organizerId ? { organizer_id: organizerId } : {};

  const total = await Event.countDocuments(query);
  const events = await Event.find(query)
    .populate('interests', 'title')
    .populate('organizer_id', 'name')
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  const [reviewStats, ids] = [await reviewStatsFor(events.map((e) => e._id)), events.map((e) => e._id)];

  const data = events.map((e) => {
    const rs = reviewStats.get(String(e._id));
    return {
      event_id: e.id,
      event_name: e.trip_name,
      event_image: firstImagePath(e.media),
      start_date: dateOnly(e.start_date),
      end_date: dateOnly(e.end_date),
      location: e.location_name,
      status: e.status,
      organizer_name: e.organizer_id?.name,
      starting_price: priceDisplay(minPrice(e.prices)),
      rating: { avg: rs ? rs.avg_rating : 0, count: rs ? rs.review_count : 0 },
      interests: e.interests.map((i) => ({ id: i.id, title: i.title })),
    };
  });

  return { data, pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) } };
}

async function getAttendedEvents(userId, page = 1) {
  const perPage = 15;
  const query = { user_id: userId, status: { $in: ['confirmed', 'used'] }, deleted_at: null };

  const total = await TicketBooking.countDocuments(query);
  const bookings = await TicketBooking.find(query)
    .populate('event_id')
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  const eventIds = bookings.map((b) => b.event_id?._id).filter(Boolean);
  const priceMap = new Map(bookings.filter((b) => b.event_id).map((b) => [String(b.event_id._id), minPrice(b.event_id.prices)]));

  const data = bookings.map((b) => ({
    booking_id: b.id,
    invoice_number: b.invoice_number,
    booking_status: b.status,
    total_amount: b.total_amount,
    is_free: b.total_amount === 0,
    qr_token: b.qr_token,
    scanned_at: b.scanned_at ? b.scanned_at.toISOString().replace('T', ' ').slice(0, 19) : null,
    booked_at: b.created_at.toISOString().replace('T', ' ').slice(0, 19),
    event: b.event_id
      ? {
          event_id: b.event_id.id,
          event_name: b.event_id.trip_name,
          event_image: firstImagePath(b.event_id.media) || b.event_id.image_thumbnail,
          start_date: dateOnly(b.event_id.start_date),
          end_date: dateOnly(b.event_id.end_date),
          location: b.event_id.location_name,
          event_status: b.event_id.status,
          starting_price: priceDisplay(priceMap.get(String(b.event_id._id))),
        }
      : null,
  }));

  return { data, pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) } };
}

// ── Geo search ───────────────────────────────────────────────────────────────

async function getEventsByLocation(userId, lat, lng, page = 1) {
  const radius = await getUserRadius(userId);
  const today = new Date(new Date().toISOString().slice(0, 10)); // midnight UTC boundary, as a real Date (not a string) — aggregate() pipelines skip Mongoose's auto-casting
  const perPage = 15;

  const pipeline = [
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: '_distanceKm',
        distanceMultiplier: 0.001,
        maxDistance: radius * 1000,
        spherical: true,
        query: { status: { $nin: ['pending', 'cancel', 'draft'] }, end_date: { $gte: today } },
      },
    },
    { $sort: { _distanceKm: 1, start_date: 1 } },
  ];

  const all = await Event.aggregate(pipeline);
  all.forEach((e) => (e.id = String(e._id))); // aggregate() returns plain objects — no automatic `id` virtual
  const total = all.length;
  const pageItems = all.slice((page - 1) * perPage, page * perPage);
  const events = await Event.populate(pageItems, [{ path: 'interests', select: 'title' }]);

  if (total === 0) {
    return { data: [], pagination: {}, _message: 'No events found in your area.' };
  }

  const [reviewStats, visitStats] = await Promise.all([reviewStatsFor(events.map((e) => e._id)), visitStatsFor(events.map((e) => e._id))]);
  const favouriteEventIds = new Set((await Event.find({ favourited_by: userId }).select('_id')).map((e) => String(e._id)));

  const data = events.map((e) => formatSingleEvent(e, { reviewStats, visitStats, favouriteEventIds, distanceKm: e._distanceKm }));

  return { data, pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) }, _message: 'Events fetched successfully.' };
}

async function getEventsByRoute(userId, startLat, startLng, endLat, endLng, waypoints = [], page = 1) {
  const radius = await getUserRadius(userId);
  const today = new Date(new Date().toISOString().slice(0, 10)); // midnight UTC boundary, as a real Date (not a string) — aggregate() pipelines skip Mongoose's auto-casting
  const perPage = 15;

  const routePoints = [{ lat: startLat, lng: startLng }, ...waypoints.map((w) => ({ lat: Number(w.lat), lng: Number(w.lng) })), { lat: endLat, lng: endLng }];

  const radiusDegrees = radius / 111.0;
  const lats = routePoints.map((p) => p.lat);
  const lngs = routePoints.map((p) => p.lng);
  const minLat = Math.min(...lats) - radiusDegrees;
  const maxLat = Math.max(...lats) + radiusDegrees;
  const minLng = Math.min(...lngs) - radiusDegrees;
  const maxLng = Math.max(...lngs) + radiusDegrees;

  const buildRouteInfo = (eventsFound) => ({
    route: { start: routePoints[0], waypoints: routePoints.slice(1, -1), end: routePoints[routePoints.length - 1], total_segments: routePoints.length - 1 },
    radius_km: radius,
    events_found: eventsFound,
  });

  const candidates = await Event.find({
    status: { $nin: ['pending', 'cancel', 'draft'] },
    end_date: { $gte: today },
    location_lat: { $ne: null, $gte: minLat, $lte: maxLat },
    location_long: { $ne: null, $gte: minLng, $lte: maxLng },
  }).populate('interests', 'title');

  if (candidates.length === 0) {
    return { data: [], pagination: {}, route_info: buildRouteInfo(0), _message: 'No events found along this route.' };
  }

  const distances = new Map();
  candidates.forEach((event) => {
    let minDistance = Infinity;
    for (let i = 0; i < routePoints.length - 1; i++) {
      const seg = distanceFromPointToLineSegment(event.location_lat, event.location_long, routePoints[i].lat, routePoints[i].lng, routePoints[i + 1].lat, routePoints[i + 1].lng);
      minDistance = Math.min(minDistance, seg);
    }
    if (minDistance <= radius) {
      distances.set(String(event._id), Math.round(minDistance * 100) / 100);
    }
  });

  if (distances.size === 0) {
    return { data: [], pagination: {}, route_info: buildRouteInfo(0), _message: 'No events found within your radius along this route.' };
  }

  const filtered = candidates.filter((e) => distances.has(String(e._id)));
  filtered.sort((a, b) => {
    const d = distances.get(String(a._id)) - distances.get(String(b._id));
    return d !== 0 ? d : a.start_date - b.start_date;
  });

  const total = filtered.length;
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

  const [reviewStats, visitStats] = await Promise.all([reviewStatsFor(pageItems.map((e) => e._id)), visitStatsFor(pageItems.map((e) => e._id))]);
  const favouriteEventIds = new Set((await Event.find({ favourited_by: userId }).select('_id')).map((e) => String(e._id)));

  const data = pageItems.map((e) => {
    const formatted = formatSingleEvent(e, { reviewStats, visitStats, favouriteEventIds, distanceKm: null });
    formatted.distance_from_route_km = distances.get(String(e._id));
    return formatted;
  });

  return {
    data,
    pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) },
    route_info: buildRouteInfo(total),
    _message: 'Events along route fetched successfully.',
  };
}

// ── Home feed (4 lists) ──────────────────────────────────────────────────────
// NOTE: matches current Laravel behavior exactly — only "upcoming" applies the
// radius filter; for_you/top_rated/most_visited have it disabled (commented out
// in EventRepository), so they search without a distance bound. Ticketmaster
// external-event blending is wired in the Misc/Search module (plan step 11), not here.

async function fetchUpcoming(lat, lng, radius, today, favouriteEventIds) {
  const pipeline = [
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: '_distanceKm',
        distanceMultiplier: 0.001,
        maxDistance: radius * 1000,
        spherical: true,
        query: { status: { $nin: ['pending', 'cancel', 'draft'] }, end_date: { $gte: today } },
      },
    },
    { $sort: { _distanceKm: 1, start_date: 1 } },
    { $limit: HOME_LIST_LIMIT },
  ];
  const events = await Event.aggregate(pipeline);
  events.forEach((e) => (e.id = String(e._id))); // aggregate() returns plain objects — no automatic `id` virtual
  const populated = await Event.populate(events, [{ path: 'interests', select: 'title' }]);
  const [reviewStats, visitStats] = await Promise.all([reviewStatsFor(populated.map((e) => e._id)), visitStatsFor(populated.map((e) => e._id))]);
  return populated.map((e) => formatSingleEvent(e, { reviewStats, visitStats, favouriteEventIds, distanceKm: e._distanceKm }));
}

async function fetchForYou(lat, lng, today, userInterestIds, favouriteEventIds) {
  if (!userInterestIds.length) return [];

  const events = await Event.find({
    status: { $nin: ['pending', 'cancel', 'draft'] },
    end_date: { $gte: today },
    interests: { $in: userInterestIds },
  })
    .populate('interests', 'title')
    .limit(CANDIDATE_CAP);

  const [reviewStats, visitStats] = await Promise.all([reviewStatsFor(events.map((e) => e._id)), visitStatsFor(events.map((e) => e._id))]);
  const interestSet = new Set(userInterestIds.map(String));

  const withDistance = events.map((e) => {
    const matchCount = e.interests.filter((i) => interestSet.has(String(i._id ?? i.id))).length;
    const distanceKm = e.location_lat != null ? haversineDistanceKm(lat, lng, e.location_lat, e.location_long) : null;
    return { event: e, matchCount, distanceKm };
  });

  withDistance.sort((a, b) => (b.matchCount !== a.matchCount ? b.matchCount - a.matchCount : (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)));

  return withDistance
    .slice(0, HOME_LIST_LIMIT)
    .map(({ event, matchCount, distanceKm }) => formatSingleEvent(event, { reviewStats, visitStats, favouriteEventIds, distanceKm, interestMatchCount: matchCount }));
}

async function fetchTopRated(lat, lng, today, favouriteEventIds) {
  const events = await Event.find({ status: { $nin: ['pending', 'cancel', 'draft'] }, end_date: { $gte: today } })
    .populate('interests', 'title')
    .limit(CANDIDATE_CAP);

  const reviewStats = await reviewStatsFor(events.map((e) => e._id));
  const rated = events.filter((e) => (reviewStats.get(String(e._id))?.avg_rating || 0) > 0);

  rated.sort((a, b) => {
    const ra = reviewStats.get(String(a._id));
    const rb = reviewStats.get(String(b._id));
    if (rb.avg_rating !== ra.avg_rating) return rb.avg_rating - ra.avg_rating;
    if (rb.review_count !== ra.review_count) return rb.review_count - ra.review_count;
    const da = a.location_lat != null ? haversineDistanceKm(lat, lng, a.location_lat, a.location_long) : Infinity;
    const db = b.location_lat != null ? haversineDistanceKm(lat, lng, b.location_lat, b.location_long) : Infinity;
    return da - db;
  });

  const top = rated.slice(0, HOME_LIST_LIMIT);
  const visitStats = await visitStatsFor(top.map((e) => e._id));

  return top.map((e) => {
    const distanceKm = e.location_lat != null ? haversineDistanceKm(lat, lng, e.location_lat, e.location_long) : null;
    return formatSingleEvent(e, { reviewStats, visitStats, favouriteEventIds, distanceKm });
  });
}

async function fetchMostVisited(lat, lng, today, favouriteEventIds) {
  const events = await Event.find({ status: { $nin: ['pending', 'cancel', 'draft'] }, end_date: { $gte: today } })
    .populate('interests', 'title')
    .limit(CANDIDATE_CAP);

  const visitStats = await visitStatsFor(events.map((e) => e._id));
  const visited = events.filter((e) => (visitStats.get(String(e._id))?.total_visits || 0) > 0);

  visited.sort((a, b) => {
    const va = visitStats.get(String(a._id));
    const vb = visitStats.get(String(b._id));
    if (vb.total_visits !== va.total_visits) return vb.total_visits - va.total_visits;
    const da = a.location_lat != null ? haversineDistanceKm(lat, lng, a.location_lat, a.location_long) : Infinity;
    const db = b.location_lat != null ? haversineDistanceKm(lat, lng, b.location_lat, b.location_long) : Infinity;
    return da - db;
  });

  const top = visited.slice(0, HOME_LIST_LIMIT);
  const reviewStats = await reviewStatsFor(top.map((e) => e._id));

  return top.map((e) => {
    const distanceKm = e.location_lat != null ? haversineDistanceKm(lat, lng, e.location_lat, e.location_long) : null;
    return formatSingleEvent(e, { reviewStats, visitStats, favouriteEventIds, distanceKm });
  });
}

/** Mirrors EventRepository::getExternalEventPool — cached, fail-safe (never throws). */
async function getExternalEventPool(lat, lng, radius) {
  if (!env.ticketmaster.enabled) return [];

  const bucket = `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}`;
  const key = `home_ext:tm:${bucket}:${radius}`;
  return ttlCache.remember(key, 30 * 60 * 1000, () => ticketmaster.searchNearby(lat, lng, radius, 20));
}

/**
 * Mirrors EventRepository::mergeExternalIntoLists — splits the external pool
 * evenly across the 4 home lists (~5 each), appended beyond each list's own
 * limit. Falls back to a fixed NYC coordinate when the real location has no
 * Ticketmaster inventory nearby, matching the DB lists always using the real one.
 */
async function mergeExternalIntoLists(lists, lat, lng, radius) {
  let pool = await getExternalEventPool(lat, lng, radius);
  if (pool.length === 0) pool = await getExternalEventPool(40.73, -73.93, 500);
  if (pool.length === 0) return lists;

  const keys = Object.keys(lists);
  const perList = Math.ceil(pool.length / keys.length);
  const chunks = [];
  for (let i = 0; i < pool.length; i += Math.max(1, perList)) chunks.push(pool.slice(i, i + Math.max(1, perList)));

  keys.forEach((key, i) => {
    lists[key] = lists[key].concat(chunks[i] || []);
  });
  return lists;
}

async function getHomeEvents(userId, lat, lng) {
  const radius = await getUserRadius(userId);
  const today = new Date(new Date().toISOString().slice(0, 10)); // midnight UTC boundary, as a real Date (not a string) — aggregate() pipelines skip Mongoose's auto-casting

  const user = await User.findById(userId).select('interests');
  const userInterestIds = user.interests || [];
  const favouriteEventIds = new Set((await Event.find({ favourited_by: userId }).select('_id')).map((e) => String(e._id)));

  const [upcoming, forYou, topRated, mostVisited] = await Promise.all([
    fetchUpcoming(lat, lng, radius, today, favouriteEventIds),
    fetchForYou(lat, lng, today, userInterestIds, favouriteEventIds),
    fetchTopRated(lat, lng, today, favouriteEventIds),
    fetchMostVisited(lat, lng, today, favouriteEventIds),
  ]);

  const lists = await mergeExternalIntoLists({ upcoming, for_you: forYou, top_rated: topRated, most_visited: mostVisited }, lat, lng, radius);
  return lists;
}

function formatTicketCategory(category) {
  return {
    id: category.id,
    title: category.title,
    children: category.details.map((d) => ({ id: d._id.toString(), title: d.offer_title })),
  };
}

async function getAllTicketCategories(ticketCategoryId) {
  if (ticketCategoryId) {
    const category = await TicketCategory.findById(ticketCategoryId);
    if (!category) throw notFound('Ticket Category not found.');
    return [formatTicketCategory(category)];
  }

  const categories = await TicketCategory.find().sort({ _id: 1 });
  if (categories.length === 0) throw notFound('No ticket categories found.');
  return categories.map(formatTicketCategory);
}

module.exports = {
  getAllTicketCategories,
  createOrUpdateEvent,
  cancelEvent,
  deleteEvent,
  changeStatus,
  findEventById,
  trackVisit,
  saveReview,
  getEventReviews,
  getEventPrices,
  toggleFavourite,
  getUserFavourites,
  getOrganizerEvents,
  getAttendedEvents,
  getEventsByLocation,
  getEventsByRoute,
  getHomeEvents,
};
