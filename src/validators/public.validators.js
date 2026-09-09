const Joi = require('joi');
const { objectId } = require('./common');
const { error } = require('../utils/response');

const globalSearch = Joi.object({
  keyword: Joi.string().max(255).allow(null, ''),
  type: Joi.string().valid('all', 'events', 'connections', 'marketplace', 'jobs'),
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
  radius: Joi.number().integer().min(1).max(20000),
  interest_ids: Joi.array().items(objectId()),
  start_date: Joi.date(),
  end_date: Joi.date().min(Joi.ref('start_date')),
  page: Joi.number().integer().min(1),
  per_page: Joi.number().integer().min(1).max(50),
});

const dashboardData = Joi.object({
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
  limit: Joi.number().integer().min(1).max(50),
});

const eventDetail = Joi.object({
  event_id: objectId().required(),
  related_limit: Joi.number().integer().min(1).max(20),
});

// Laravel checks lat/lng-together as a standalone `if ($request->filled('lat') !==
// $request->filled('lng'))` guard, separate from $validator->errors() — it responds
// with `data: []`, not a field-keyed validation-errors object. Kept out of the Joi
// schemas above (and their field-keyed error shape) to match that exactly.
function requireLatLngTogether(req, res, next) {
  const body = req.method === 'GET' ? req.query : req.body;
  if ((body.lat !== undefined) !== (body.lng !== undefined)) {
    return error(res, 'Both lat and lng are required for a location search.', 400, []);
  }
  return next();
}

module.exports = { globalSearch, dashboardData, eventDetail, requireLatLngTogether };
