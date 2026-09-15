// Merges every module's OpenAPI path manifest into one `paths` object — one file
// per route file in src/routes/, so a route can be traced to its docs directly.
module.exports = {
  ...require('./broadcasting.paths'),
  ...require('./auth.paths'),
  ...require('./users.paths'),
  ...require('./onboarding.paths'),
  ...require('./presence.paths'),
  ...require('./taxonomy.paths'),
  ...require('./events.paths'),
  ...require('./bookings.paths'),
  ...require('./subscriptions.paths'),
  ...require('./notifications.paths'),
  ...require('./community.paths'),
  ...require('./connections.paths'),
  ...require('./chat.paths'),
  ...require('./dashboard.paths'),
  ...require('./website.paths'),
  ...require('./public.paths'),
  ...require('./adminAuth.paths'),
  ...require('./adminLookups.paths'),
  ...require('./adminPlans.paths'),
  ...require('./adminMisc.paths'),
};
