const Event = require('../models/Event');
const EventReview = require('../models/EventReview');
const TicketBooking = require('../models/TicketBooking');
const Interest = require('../models/Interest');
const TaxRate = require('../models/TaxRate');
const ticketmaster = require('../integrations/ticketmaster');
const ttlCache = require('../utils/ttlCache');
const { fileUrl } = require('../middlewares/upload');
const { escapeRegex } = require('../utils/regex');
const env = require('../config/env');

const DEFAULT_RADIUS_KM = 50;

function fail(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

function priceDisplay(price) {
  return price !== null && price !== undefined && price > 0 ? Number(price).toFixed(2) : 'Free';
}

function minPrice(prices) {
  const active = (prices || []).filter((p) => !p.deleted_at);
  return active.length ? Math.min(...active.map((p) => p.price)) : null;
}

// Mirrors Event's Laravel cast ('date:Y-m-d') — list payloads show a bare date,
// not the full Mongoose Date's ISO timestamp.
function dateOnly(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

async function reviewStatsFor(eventIds) {
  const rows = await EventReview.aggregate([
    { $match: { event_id: { $in: eventIds }, is_approved: true, deleted_at: null } },
    { $group: { _id: '$event_id', avg_rating: { $avg: '$rating' }, review_count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { avg_rating: Math.round(r.avg_rating * 10) / 10, review_count: r.review_count }]));
}

/** Mirrors PublicRepository::formatEventList — note: source 'addventure', no is_favt/favt_id (unauthenticated). */
async function formatEventList(events) {
  const reviewStats = await reviewStatsFor(events.map((e) => e._id));
  return events.map((event) => {
    const rs = reviewStats.get(String(event._id));
    return {
      event_id: event.id,
      source: 'addventure',
      external_id: null,
      booking_url: null,
      event_name: event.trip_name,
      event_image: event.media?.[0]?.file_path || null,
      description: event.description,
      start_date: dateOnly(event.start_date),
      end_date: dateOnly(event.end_date),
      location: event.location_name,
      location_lat: event.location_lat,
      location_long: event.location_long,
      distance_km: event._distanceKm !== undefined && event._distanceKm !== null ? Math.round(event._distanceKm) : null,
      starting_price: priceDisplay(minPrice(event.prices)),
      rating: { avg: rs ? rs.avg_rating : 0, count: rs ? rs.review_count : 0 },
      interests: (event.interests || []).map((i) => ({ id: i.id, title: i.title })),
    };
  });
}

/** Fetches events with an optional geo distance annotation — mirrors eventBaseQuery. */
async function queryEvents(matchQuery, { lat, lng, maxDistanceKm, sort, limit, skip = 0 } = {}) {
  if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
    const pipeline = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: '_distanceKm',
          distanceMultiplier: 0.001,
          spherical: true,
          query: matchQuery,
          ...(maxDistanceKm ? { maxDistance: maxDistanceKm * 1000 } : {}),
        },
      },
    ];
    // _id makes the ordering total. Without it, events sharing a start date (or
    // an exact distance) can come back in a different relative order on each
    // query, so skip/limit hands the same document out on two pages and silently
    // drops another.
    if (sort === 'distance') pipeline.push({ $sort: { _distanceKm: 1, _id: 1 } });
    else pipeline.push({ $sort: { start_date: 1, _id: 1 } });
    if (skip) pipeline.push({ $skip: skip });
    if (limit) pipeline.push({ $limit: limit });

    const events = await Event.aggregate(pipeline);
    events.forEach((e) => (e.id = String(e._id)));
    return Event.populate(events, [{ path: 'interests', select: 'title' }]);
  }

  let query = Event.find(matchQuery)
    .populate('interests', 'title')
    .sort({ start_date: 1, _id: 1 })
    .skip(skip);
  if (limit) query = query.limit(limit);
  return query;
}

const EXTERNAL_MIN_POOL = 20; // page 1 stays exactly as cheap as it was before
const EXTERNAL_MAX_POOL = 200; // Discovery API ceiling

async function getExternalEventPool(lat, lng, radius, filters, size = EXTERNAL_MIN_POOL) {
  if (!env.ticketmaster.enabled) return [];

  const bucket = lat !== null && lat !== undefined && lng !== null && lng !== undefined ? `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}` : 'any';
  // size is part of the key: page 1 caches a short pool, and a deeper page asking
  // for a longer one must not be handed that truncated entry.
  const key = `public_ext:tm:${bucket}:${radius}:${size}:${JSON.stringify(filters)}`;

  return ttlCache.remember(key, 30 * 60 * 1000, () => ticketmaster.search(lat, lng, radius, size, filters));
}

/**
 * One page of Ticketmaster results. `offset` is what stops a paged search from
 * replaying the same first rows on every page: the pool is fetched deep enough to
 * reach the requested page, then sliced there. Callers that only ever want the
 * first slice (the landing dashboard) can leave it at 0.
 */
async function externalEvents(lat, lng, radius, limit, filters = {}, offset = 0) {
  const size = Math.min(EXTERNAL_MAX_POOL, Math.max(EXTERNAL_MIN_POOL, offset + limit));
  let pool = await getExternalEventPool(lat, lng, radius, filters, size);
  if (pool.length === 0 && lat !== null && lat !== undefined && lng !== null && lng !== undefined) {
    pool = await getExternalEventPool(40.73, -73.93, 500, filters, size);
  }
  return pool.slice(offset, offset + Math.max(1, limit)).map(({ is_favt, favt_id, ...rest }) => rest);
}

// ── Global search ────────────────────────────────────────────────────────────

async function expandInterestIds(ids) {
  const clean = [...new Set(ids.map(String))];
  if (clean.length === 0) return [];
  const children = await Interest.find({ parent_id: { $in: clean } }).select('_id');
  return [...new Set([...clean, ...children.map((c) => String(c._id))])];
}

async function searchEvents(params) {
  const keyword = params.keyword || null;
  const lat = params.lat !== undefined ? Number(params.lat) : null;
  const lng = params.lng !== undefined ? Number(params.lng) : null;
  const radius = params.radius ? Number(params.radius) : DEFAULT_RADIUS_KM;
  const perPage = Number(params.per_page || 10);
  const page = Number(params.page || 1);

  const match = { status: { $nin: ['pending', 'cancel', 'draft'] }, end_date: { $gte: new Date() } };

  if (keyword) {
    const safeKeyword = escapeRegex(keyword);
    const interestMatches = await Interest.find({ title: { $regex: safeKeyword, $options: 'i' } }).select('_id');
    match.$or = [
      { trip_name: { $regex: safeKeyword, $options: 'i' } },
      { location_name: { $regex: safeKeyword, $options: 'i' } },
      { description: { $regex: safeKeyword, $options: 'i' } },
      { interests: { $in: interestMatches.map((i) => i._id) } },
    ];
  }

  if (params.interest_ids && params.interest_ids.length) {
    const expanded = await expandInterestIds(params.interest_ids);
    match.interests = { $in: expanded };
  }

  if (params.start_date) match.end_date = { $gte: new Date(params.start_date) };
  if (params.end_date) match.start_date = { $lte: new Date(params.end_date) };

  const hasGeo = lat !== null && lng !== null;
  const events = await queryEvents(match, {
    lat,
    lng,
    maxDistanceKm: hasGeo ? radius : undefined,
    sort: hasGeo ? 'distance' : 'start_date',
    limit: perPage,
    skip: (page - 1) * perPage,
  });

  let formatted = await formatEventList(events);

  if (!params.interest_ids || !params.interest_ids.length) {
    const filters = { keyword, start_date: params.start_date, end_date: params.end_date };
    formatted = formatted.concat(await externalEvents(lat, lng, radius, perPage, filters, (page - 1) * perPage));
  }

  return formatted;
}

const MODULES = ['events', 'connections', 'marketplace', 'jobs'];

async function globalSearch(params) {
  const type = params.type || 'all';
  const modules = type === 'all' ? MODULES : [type];

  const results = {};
  for (const module of modules) {
    results[module] = module === 'events' ? await searchEvents(params) : [];
  }

  const found = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
  return { data: results, message: found > 0 ? 'Search results fetched successfully.' : 'No results found.' };
}

// ── Landing dashboard ────────────────────────────────────────────────────────

async function todayEvents(limit, lat, lng) {
  const today = new Date().toISOString().slice(0, 10);
  const match = { status: { $nin: ['pending', 'cancel', 'draft'] }, start_date: { $lte: new Date(today) }, end_date: { $gte: new Date(today) } };
  const events = await queryEvents(match, { lat, lng, sort: 'start_date', limit });
  const formatted = await formatEventList(events);
  return formatted.concat(await externalEvents(lat, lng, DEFAULT_RADIUS_KM, limit, { start_date: today, end_date: today }));
}

async function upcomingEvents(limit, lat, lng) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const match = {
    status: { $nin: ['pending', 'cancel', 'draft'] },
    start_date: { $lte: new Date(weekEnd), $gt: new Date(today) },
    end_date: { $gte: new Date(tomorrow) },
  };
  const events = await queryEvents(match, { lat, lng, sort: 'start_date', limit });
  const formatted = await formatEventList(events);
  return formatted.concat(await externalEvents(lat, lng, DEFAULT_RADIUS_KM, limit, { start_date: tomorrow, end_date: weekEnd }));
}

async function eventCountsByInterest() {
  const rows = await Event.aggregate([
    { $match: { status: { $nin: ['pending', 'cancel', 'draft'] }, end_date: { $gte: new Date() }, deleted_at: null } },
    { $unwind: '$interests' },
    { $group: { _id: '$interests', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

async function categories() {
  const cats = await Interest.find({ parent_id: null }).select('title image').sort({ title: 1 });
  const children = await Interest.find({ parent_id: { $ne: null } }).select('parent_id');
  const rollsUpTo = new Map(children.map((c) => [String(c._id), String(c.parent_id)]));
  const counts = await eventCountsByInterest();

  const byCategory = new Map();
  for (const [interestId, count] of counts) {
    const categoryId = rollsUpTo.get(interestId) || interestId;
    byCategory.set(categoryId, (byCategory.get(categoryId) || 0) + count);
  }

  return cats.map((c) => ({ id: c.id, title: c.title, image: c.image, events_count: byCategory.get(String(c._id)) || 0 }));
}

async function getLandingDashboard(params) {
  const limit = Number(params.limit || 10);
  const lat = params.lat !== undefined ? Number(params.lat) : null;
  const lng = params.lng !== undefined ? Number(params.lng) : null;

  return {
    today_events: await todayEvents(limit, lat, lng),
    upcoming_events: await upcomingEvents(limit, lat, lng),
    categories: await categories(),
  };
}

async function getCategories() {
  return categories();
}

// ── Event detail ─────────────────────────────────────────────────────────────

async function spotsLeft(event) {
  const prices = (event.prices || []).filter((p) => !p.deleted_at);
  if (prices.length === 0 || prices.some((p) => p.is_unlimited_tickets === 'yes')) return null;

  const priceIds = prices.map((p) => p._id);
  const sold = await TicketBooking.aggregate([
    { $match: { event_id: event._id, status: { $in: ['confirmed', 'pending'] } } },
    { $unwind: '$items' },
    { $match: { 'items.event_price_id': { $in: priceIds } } },
    { $group: { _id: '$items.event_price_id', qty: { $sum: '$items.quantity' } } },
  ]);
  const soldMap = new Map(sold.map((s) => [String(s._id), s.qty]));

  return prices.reduce((sum, p) => sum + Math.max(0, p.ticket_quantity - (soldMap.get(String(p._id)) || 0)), 0);
}

async function customerServiceFeeRate() {
  const rate = await TaxRate.findOne({ is_active: true, tax_category: 'general' });
  return rate ? Math.round(rate.rate * 10000) / 10000 : 0;
}

async function eventReviews(eventId, limit = 10) {
  const reviews = await EventReview.find({ event_id: eventId, is_approved: true })
    .populate('user_id', 'name')
    .sort({ _id: -1 })
    .limit(limit);

  return reviews.map((r) => ({
    review_id: r.id,
    user_id: r.user_id?.id,
    user_name: r.user_id?.name,
    rating: r.rating,
    review: r.review,
    reviewed_at: r.created_at.toISOString().replace('T', ' ').slice(0, 19),
  }));
}

async function relatedEvents(event, limit) {
  const lat = event.location_lat;
  const lng = event.location_long;
  const interestIds = (event.interests || []).map((i) => i.id || i._id || i);

  let related = [];
  if (interestIds.length) {
    const match = { status: { $nin: ['pending', 'cancel', 'draft'] }, end_date: { $gte: new Date() }, _id: { $ne: event._id }, interests: { $in: interestIds } };
    related = await queryEvents(match, { lat, lng, sort: lat !== null && lat !== undefined ? 'distance' : 'start_date', limit });
  }

  if (related.length < limit) {
    const excludeIds = [...related.map((r) => r._id || r.id), event._id];
    const match = { status: { $nin: ['pending', 'cancel', 'draft'] }, end_date: { $gte: new Date() }, _id: { $nin: excludeIds } };
    const filler = await queryEvents(match, { sort: 'start_date', limit: limit - related.length });
    related = related.concat(filler);
  }

  return formatEventList(related);
}

async function getEventDetail(eventId, relatedLimit = 8) {
  const event = await Event.findById(eventId)
    .populate('interests', 'title')
    .populate({ path: 'organizer_id', select: 'name profile.image' });

  if (!event || ['pending', 'cancel', 'draft'].includes(event.status)) {
    throw fail('Event not found.');
  }

  const [reviewStats, spots, feeRate, reviews, related] = await Promise.all([
    reviewStatsFor([event._id]),
    spotsLeft(event),
    customerServiceFeeRate(),
    eventReviews(event._id),
    relatedEvents(event, relatedLimit),
  ]);
  const rs = reviewStats.get(String(event._id));

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
    organizer: { id: event.organizer_id?.id, name: event.organizer_id?.name, image: event.organizer_id?.profile?.image ? fileUrl(event.organizer_id.profile.image) : null },
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
    spots_left: spots,
    service_fee_rate: feeRate,
    rating: { avg: rs ? rs.avg_rating : 0, count: rs ? rs.review_count : 0 },
    reviews,
    related_events: related,
  };
}

module.exports = { globalSearch, getLandingDashboard, getEventDetail, getCategories };
