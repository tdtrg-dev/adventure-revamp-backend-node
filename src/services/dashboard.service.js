const mongoose = require('mongoose');
const Connection = require('../models/Connection');
const Conversation = require('../models/Conversation');
const Event = require('../models/Event');
const Message = require('../models/Message');
const Post = require('../models/Post');
const PostComment = require('../models/PostComment');
const TicketBooking = require('../models/TicketBooking');
const TicketCategory = require('../models/TicketCategory');
const User = require('../models/User');
const { dateOnly, diffForHumans, dayMonthYear } = require('../utils/dateFormat');

function money(n, prefix = 'USD') {
  return `${prefix} ${Number(n || 0).toFixed(2)}`;
}

function fail(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

// ── Stats — mirrors DashboardRepository::getStats' single-query counters ──────

async function getStats(uid) {
  const [totalFriendRequests, totalPurchasedTickets, totalHostedEvents, totalCommunityPosts, totalActiveChats] = await Promise.all([
    Connection.countDocuments({ receiver_id: uid, status: 'pending' }),
    TicketBooking.countDocuments({ user_id: uid, status: { $in: ['confirmed', 'used'] }, deleted_at: null }),
    Event.countDocuments({ organizer_id: uid, deleted_at: null }),
    Post.countDocuments({ user_id: uid, status: 'publish', deleted_at: null }),
    Conversation.countDocuments({ 'participants.user_id': uid, deleted_at: null }),
  ]);

  const myEventIds = (await Event.find({ organizer_id: uid, deleted_at: null }).select('_id')).map((e) => e._id);

  const [attended] = await TicketBooking.aggregate([
    { $match: { user_id: uid, status: { $in: ['confirmed', 'used'] }, deleted_at: null, event_id: { $nin: myEventIds } } },
    { $group: { _id: null, events: { $addToSet: '$event_id' } } },
  ]);

  const [earnings] = await TicketBooking.aggregate([
    { $match: { event_id: { $in: myEventIds }, status: { $in: ['confirmed', 'used'] }, deleted_at: null } },
    { $group: { _id: null, total: { $sum: '$organizer_net_amount' } } },
  ]);

  return {
    total_friend_requests: totalFriendRequests,
    total_purchased_tickets: totalPurchasedTickets,
    total_hosted_events: totalHostedEvents,
    total_community_posts: totalCommunityPosts,
    total_active_chats: totalActiveChats,
    total_attended_events: attended ? attended.events.length : 0,
    total_earnings: `$ ${Number(earnings?.total || 0).toFixed(2)}`,
  };
}

// ── My Booked Events ────────────────────────────────────────────────────────

async function getBookedEvents(uid, page) {
  const perPage = 10;
  const query = { user_id: uid, status: { $in: ['confirmed', 'used'] } };

  const total = await TicketBooking.countDocuments(query);
  const bookings = await TicketBooking.find(query)
    .populate({ path: 'event_id', select: 'trip_name location_name start_date end_date organizer_id media interests', populate: { path: 'interests', select: 'title' } })
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  const catIds = bookings.flatMap((b) => b.items.map((i) => i.ticket_cat_id));
  const categories = await TicketCategory.find({ _id: { $in: catIds } }).select('title');
  const catMap = new Map(categories.map((c) => [String(c._id), c.title]));

  const data = bookings.map((b) => ({
    booking_id: b.id,
    invoice_number: b.invoice_number,
    booking_date: dateOnly(b.created_at),
    status: b.status,
    total_price: b.total_amount === 0 ? 'Free' : money(b.total_amount, b.currency),
    event_name: b.event_id?.trip_name,
    event_location: b.event_id?.location_name,
    event_start_date: dayMonthYear(b.event_id?.start_date),
    event_image: b.event_id?.media?.[0]?.file_path || null,
    event_interests: (b.event_id?.interests || []).map((i) => i.title).filter(Boolean),
    ticket_categories: b.items.map((item) => ({
      category: catMap.get(String(item.ticket_cat_id)) || null,
      quantity: item.quantity,
      unit_price: Number(item.unit_price).toFixed(2),
      line_total: Number(item.line_total).toFixed(2),
    })),
  }));

  return { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)), data };
}

// ── My Hosted Events ────────────────────────────────────────────────────────

async function getHostedEvents(uid, page) {
  const perPage = 10;
  const myEventIds = (await Event.find({ organizer_id: uid, deleted_at: null }).select('_id')).map((e) => e._id);

  const [totals] = await TicketBooking.aggregate([
    { $match: { event_id: { $in: myEventIds }, status: { $in: ['confirmed', 'used'] }, deleted_at: null } },
    { $group: { _id: null, total_revenue: { $sum: '$organizer_net_amount' }, total_attendees: { $sum: 1 } } },
  ]);

  const query = { organizer_id: uid, deleted_at: null };
  const total = await Event.countDocuments(query);
  const events = await Event.find(query)
    .select('trip_name start_date location_name status media prices')
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  const eventIds = events.map((e) => e._id);

  // Ticket-item quantities (unwound) and booking-level revenue/attendee counts need
  // separate pipelines — unwinding items would multiply the attendee/revenue totals.
  const soldByEvent = await TicketBooking.aggregate([
    { $match: { event_id: { $in: eventIds }, status: { $in: ['confirmed', 'used'] }, deleted_at: null } },
    { $unwind: '$items' },
    { $group: { _id: '$event_id', tickets_sold: { $sum: '$items.quantity' } } },
  ]);
  const revenueByEvent = await TicketBooking.aggregate([
    { $match: { event_id: { $in: eventIds }, status: { $in: ['confirmed', 'used'] }, deleted_at: null } },
    { $group: { _id: '$event_id', total_revenue: { $sum: '$organizer_net_amount' }, total_attendees: { $sum: 1 } } },
  ]);
  const soldMap = new Map(soldByEvent.map((r) => [String(r._id), r.tickets_sold]));
  const revenueMap = new Map(revenueByEvent.map((r) => [String(r._id), { revenue: r.total_revenue, attendees: r.total_attendees }]));

  const eventList = events.map((e) => {
    const agg = revenueMap.get(String(e._id));
    return {
      event_id: e.id,
      event_name: e.trip_name,
      event_start_date: dayMonthYear(e.start_date),
      event_location: e.location_name,
      event_status: e.status,
      event_image: e.media?.[0]?.file_path || null,
      tickets_total: (e.prices || []).reduce((sum, p) => sum + (p.ticket_quantity || 0), 0),
      tickets_sold: soldMap.get(String(e._id)) || 0,
      total_attendees: agg ? agg.attendees : 0,
      total_revenue: money(agg ? agg.revenue : 0),
    };
  });

  return {
    summary: {
      total_revenue: money(totals ? totals.total_revenue : 0),
      total_attendees: totals ? totals.total_attendees : 0,
    },
    events: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)), data: eventList },
  };
}

// ── Community Feed ──────────────────────────────────────────────────────────

async function getCommunityFeed(uid) {
  const connections = await Connection.find({ $or: [{ sender_id: uid }, { receiver_id: uid }], status: 'accepted' });
  const friendIds = [...new Set(connections.map((c) => String(c.sender_id) === String(uid) ? String(c.receiver_id) : String(c.sender_id)))];

  const me = await User.findById(uid).select('blocked_users');
  const blockersOfMe = await User.find({ blocked_users: uid }).select('_id');
  const blockedIds = [...new Set([...(me?.blocked_users || []).map(String), ...blockersOfMe.map((u) => String(u._id))])];

  const feedUserIds = [String(uid), ...friendIds].filter((id) => !blockedIds.includes(id));

  const posts = await Post.find({ user_id: { $in: feedUserIds }, status: 'publish', deleted_at: null })
    .populate('user_id', 'name profile.image')
    .sort({ _id: -1 })
    .limit(5);

  const postIds = posts.map((p) => p._id);
  const commentCounts = await PostComment.aggregate([
    { $match: { post_id: { $in: postIds }, deleted_at: null } },
    { $group: { _id: '$post_id', count: { $sum: 1 } } },
  ]);
  const commentMap = new Map(commentCounts.map((c) => [String(c._id), c.count]));

  return posts.map((p) => ({
    post_id: p.id,
    poster_name: p.user_id?.name,
    poster_image: p.user_id?.profile?.image || null,
    description: p.description,
    posted_ago: diffForHumans(p.created_at),
    likes_count: (p.reactions || []).length,
    comments_count: commentMap.get(String(p._id)) || 0,
    shares_count: (p.shared_by || []).length,
  }));
}

// ── Friends ──────────────────────────────────────────────────────────────────

async function getFriends(uid) {
  const connections = await Connection.find({ $or: [{ sender_id: uid }, { receiver_id: uid }], status: 'accepted' })
    .populate('sender_id', 'name profile.image')
    .populate('receiver_id', 'name profile.image')
    .sort({ _id: -1 })
    .limit(4);

  const friendIds = connections.map((c) => (String(c.sender_id?._id || c.sender_id) === String(uid) ? c.receiver_id : c.sender_id));
  const friendIdList = friendIds.map((f) => f._id || f);

  // NOTE: Laravel's badge check queries Event.status = 'published', a value that
  // never exists in the real enum ('pending'|'publish'|'cancel') — a genuine bug
  // there that always leaves this branch false. Replicated exactly for parity.
  const organizerIds = new Set((await Event.find({ organizer_id: { $in: friendIdList }, status: 'published' }).distinct('organizer_id')).map(String));
  const communityIds = new Set((await Post.find({ user_id: { $in: friendIdList }, status: 'publish' }).distinct('user_id')).map(String));

  return connections.map((conn) => {
    const isSender = String(conn.sender_id?._id || conn.sender_id) === String(uid);
    const friend = isSender ? conn.receiver_id : conn.sender_id;
    const friendId = String(friend?._id || friend);

    const badge = organizerIds.has(friendId) ? 'Event organizer' : communityIds.has(friendId) ? 'Community member' : 'Member';

    return {
      user_id: friend?.id || friendId,
      name: friend?.name,
      image: friend?.profile?.image || null,
      badge,
    };
  });
}

// ── Upcoming Events ──────────────────────────────────────────────────────────

async function getUpcomingEvents(uid) {
  const today = new Date(new Date().toISOString().slice(0, 10));

  // $lookup + sort-by-joined-field mirrors Laravel's join('events', ...)->orderBy('events.start_date').
  const rows = await TicketBooking.aggregate([
    { $match: { user_id: uid, status: { $in: ['confirmed', 'used'] } } },
    { $lookup: { from: 'events', localField: 'event_id', foreignField: '_id', as: 'event' } },
    { $unwind: '$event' },
    { $match: { 'event.start_date': { $gte: today }, 'event.deleted_at': null } },
    { $sort: { 'event.start_date': 1 } },
    { $limit: 3 },
    { $project: { 'event.trip_name': 1, 'event.location_name': 1, 'event.start_date': 1, 'event.media': 1 } },
  ]);

  return rows.map((r) => ({
    event_id: String(r.event._id),
    event_name: r.event.trip_name,
    event_date: dayMonthYear(r.event.start_date),
    location: r.event.location_name,
    event_image: r.event.media?.[0]?.file_path || null,
  }));
}

// ── Messages ─────────────────────────────────────────────────────────────────

function participantUserId(p) {
  return String(p.user_id?._id || p.user_id);
}

async function getMessages(uid) {
  const conversations = await Conversation.find({ 'participants.user_id': uid, deleted_at: null })
    .populate('participants.user_id', 'name profile.image')
    .populate('group_id', 'title group_photo')
    .populate('last_message_id')
    .sort({ updated_at: -1 })
    .limit(5);

  return Promise.all(
    conversations.map(async (conv) => {
      const other = conv.is_group ? null : conv.participants.find((p) => participantUserId(p) !== String(uid));
      const otherUser = other?.user_id;

      const displayName = conv.is_group ? conv.group_id?.title || conv.name : otherUser?.name;
      const displayImage = conv.is_group ? conv.group_id?.group_photo || null : otherUser?.profile?.image || null;

      const lastMsg = conv.last_message_id;
      let preview = null;
      if (lastMsg) {
        preview = lastMsg.type === 'text' ? String(lastMsg.message).slice(0, 40) : `[${lastMsg.type.charAt(0).toUpperCase()}${lastMsg.type.slice(1)}]`;
      }

      const unreadCount = await Message.countDocuments({ conversation_id: conv._id, sender_id: { $ne: uid }, read_at: null, deleted_at: null });

      return {
        conversation_id: conv.id,
        is_group: conv.is_group,
        name: displayName,
        image: displayImage,
        last_message: preview,
        last_message_at: lastMsg ? diffForHumans(lastMsg.created_at) : null,
        unread_count: unreadCount,
        has_unread: unreadCount > 0,
      };
    })
  );
}

// ── Entry point ──────────────────────────────────────────────────────────────

async function getDashboard(userId, { bookedPage = 1, hostedPage = 1 } = {}) {
  const user = await User.findById(userId);
  if (!user) throw fail('User not found.');

  const uid = new mongoose.Types.ObjectId(userId);

  const [stats, myBookedEvents, myHostedEvents, communityFeed, friends, upcomingEvents, messages] = await Promise.all([
    getStats(uid),
    getBookedEvents(uid, bookedPage),
    getHostedEvents(uid, hostedPage),
    getCommunityFeed(uid),
    getFriends(uid),
    getUpcomingEvents(uid),
    getMessages(uid),
  ]);

  return {
    stats,
    my_booked_events: myBookedEvents,
    my_hosted_events: myHostedEvents,
    community_feed: communityFeed,
    friends,
    upcoming_events: upcomingEvents,
    messages,
  };
}

module.exports = { getDashboard };
