const Event = require('../models/Event');
const EventReview = require('../models/EventReview');

async function getAllEventReviews(page = 1, perPage = 15) {
  const matchStage = { deleted_at: null };

  const reviewedEventIds = await EventReview.distinct('event_id', { is_approved: true, deleted_at: null });
  const total = reviewedEventIds.length;

  const events = await Event.find({ _id: { $in: reviewedEventIds } })
    .populate('organizer_id', 'name profile.image')
    .skip((page - 1) * perPage)
    .limit(perPage);

  const stats = await EventReview.aggregate([
    { $match: { event_id: { $in: reviewedEventIds }, is_approved: true, deleted_at: null } },
    { $group: { _id: '$event_id', total_reviews: { $sum: 1 }, avg_rating: { $avg: '$rating' } } },
  ]);
  const statsMap = new Map(stats.map((s) => [String(s._id), s]));

  const data = events
    .map((event) => {
      const s = statsMap.get(String(event._id));
      return {
        event_id: event.id,
        event_name: event.trip_name,
        event_image: event.media?.[0]?.file_path || event.image_thumbnail,
        event_status: event.status,
        start_date: event.start_date,
        end_date: event.end_date,
        organizer_name: event.organizer_id?.name,
        organizer_image: event.organizer_id?.profile?.image || null,
        avg_rating: Math.round((s?.avg_rating || 0) * 10) / 10,
        total_reviews: s?.total_reviews || 0,
      };
    })
    .sort((a, b) => b.total_reviews - a.total_reviews);

  return { data, pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) } };
}

async function getEventReviewDetail(eventId, page = 1, perPage = 15) {
  const event = await Event.findById(eventId);
  if (!event) {
    const err = new Error('Event not found.');
    err.statusCode = 404;
    throw err;
  }

  const query = { event_id: eventId, is_approved: true, deleted_at: null };
  const [statsAgg] = await EventReview.aggregate([{ $match: query }, { $group: { _id: null, total_reviews: { $sum: 1 }, avg_rating: { $avg: '$rating' } } }]);
  const total = statsAgg?.total_reviews || 0;

  const reviews = await EventReview.find(query)
    .populate('user_id', 'name profile.image')
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  return {
    event: { event_id: event.id, event_name: event.trip_name, event_image: event.image_thumbnail },
    summary: { total_reviews: total, avg_rating: Math.round((statsAgg?.avg_rating || 0) * 10) / 10 },
    reviews: reviews.map((r) => ({
      review_id: r.id,
      user_id: r.user_id?.id,
      user_name: r.user_id?.name,
      user_image: r.user_id?.profile?.image || null,
      rating: r.rating,
      remarks: r.review,
      reviewed_at: r.created_at.toISOString().replace('T', ' ').slice(0, 19),
    })),
    pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) },
  };
}

module.exports = { getAllEventReviews, getEventReviewDetail };
