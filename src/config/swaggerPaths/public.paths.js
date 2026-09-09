const { ok, err, body, query } = require('./_helpers');

module.exports = {
  '/global-search': {
    get: {
      tags: ['Public'],
      summary: 'Search events by keyword/location/interest/date (external Ticketmaster results blended in)',
      parameters: query('PublicGlobalSearch'),
      responses: { 200: ok('Search results fetched.'), 400: err('Validation failed.') },
    },
    post: {
      tags: ['Public'],
      summary: 'Search events (same as GET, filters in the JSON body)',
      ...body('PublicGlobalSearch'),
      responses: { 200: ok('Search results fetched.'), 400: err('Validation failed.') },
    },
  },
  '/dashboard-data': {
    get: {
      tags: ['Public'],
      summary: "Public landing-page dashboard (today's + upcoming events, categories)",
      parameters: query('PublicDashboardData'),
      responses: { 200: ok('Dashboard fetched.'), 400: err('Validation failed, or only one of lat/lng supplied.') },
    },
    post: {
      tags: ['Public'],
      summary: 'Public landing-page dashboard (same as GET, filters in the JSON body)',
      ...body('PublicDashboardData'),
      responses: { 200: ok('Dashboard fetched.'), 400: err('Validation failed, or only one of lat/lng supplied.') },
    },
  },
  '/event-detail': {
    get: {
      tags: ['Public'],
      summary: 'Public event detail with related-events row (unauthenticated clone of /find-event)',
      parameters: query('PublicEventDetail'),
      responses: { 200: ok('Event found.'), 400: err('Validation failed, or the event does not exist / is not published.') },
    },
  },
  '/categories': {
    get: {
      tags: ['Public'],
      summary: 'List top-level interest categories with live event counts',
      responses: { 200: ok('Categories fetched.'), 400: err('The lookup errored.') },
    },
  },
};
