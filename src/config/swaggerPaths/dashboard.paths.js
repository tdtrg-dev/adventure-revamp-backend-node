const { ok, err, unauthorized, auth, body } = require('./_helpers');

module.exports = {
  '/dashboard-stat': {
    post: {
      tags: ['Dashboard'],
      summary: "Authenticated user's home dashboard (stats, booked/hosted events, community feed, friends, upcoming events, messages)",
      ...auth,
      ...body('DashboardGetDashboard'),
      responses: { 200: ok('Dashboard fetched.'), 400: err('Validation failed or user not found.'), 401: unauthorized() },
    },
  },
};
