const { ok, okList, err, unauthorized, auth, body, query, pathParam } = require('./_helpers');

const pageQuery = [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }];

module.exports = {
  '/admin/get-all-users': {
    get: {
      tags: ['Admin'],
      summary: 'List all users (paginated)',
      ...auth,
      parameters: pageQuery,
      responses: { 200: ok('Users fetched successfully.'), 401: unauthorized() },
    },
  },
  '/admin/delete-user/{id}': {
    delete: {
      tags: ['Admin'],
      summary: 'Soft-delete a user account',
      ...auth,
      parameters: [pathParam('id', 'User id.')],
      responses: { 200: ok('User deleted successfully.'), 400: err('The id was invalid, or the delete failed.'), 401: unauthorized(), 404: err('No such user, or already deleted.') },
    },
  },
  '/admin/get-all-events': {
    get: {
      tags: ['Admin'],
      summary: 'List all events across every organizer (paginated)',
      ...auth,
      parameters: pageQuery,
      responses: { 200: ok('Organizer events fetched successfully.'), 401: unauthorized() },
    },
  },
  '/admin/ticket-bookings': {
    get: {
      tags: ['Admin'],
      summary: 'List all ticket bookings (paginated)',
      ...auth,
      parameters: pageQuery,
      responses: { 200: ok('All bookings fetched successfully.'), 401: unauthorized() },
    },
  },
  '/admin/ticket-bookings-detail': {
    get: {
      tags: ['Admin'],
      summary: 'Get full detail for one booking',
      ...auth,
      parameters: [{ name: 'booking_id', in: 'query', required: true, schema: { type: 'string' } }],
      responses: { 200: ok('Booking detail fetched successfully.'), 400: err('Not found.'), 401: unauthorized() },
    },
  },
  '/admin/reviews': {
    get: {
      tags: ['Admin'],
      summary: 'List all event reviews (paginated)',
      ...auth,
      parameters: [...pageQuery, { name: 'per_page', in: 'query', schema: { type: 'integer', default: 15 } }],
      responses: { 200: okList('Event reviews fetched successfully.'), 401: unauthorized() },
    },
  },
  '/admin/reviews/detail': {
    get: {
      tags: ['Admin'],
      summary: 'List reviews for a single event (paginated)',
      ...auth,
      parameters: [
        { name: 'event_id', in: 'query', required: true, schema: { type: 'string' } },
        ...pageQuery,
        { name: 'per_page', in: 'query', schema: { type: 'integer', default: 15, maximum: 100 } },
      ],
      responses: { 200: okList('Event review detail fetched successfully.'), 400: err('Validation failed.'), 401: unauthorized(), 404: err('Event not found.') },
    },
  },
  '/admin/park-stay-leads': {
    get: {
      tags: ['Admin'],
      summary: 'List Park & Stay waitlist signups (paginated, filterable)',
      ...auth,
      parameters: query('AdminParkStayLeadIndex'),
      responses: { 200: ok('Park & Stay leads fetched successfully.'), 400: err('A filter value was invalid.'), 401: unauthorized() },
    },
  },
  '/admin/park-stay-leads/{id}/status': {
    patch: {
      tags: ['Admin'],
      summary: "Update a signup's follow-up status",
      ...auth,
      parameters: [pathParam('id', 'Park & Stay lead id.')],
      ...body('AdminParkStayLeadStatus'),
      responses: { 200: ok('Lead status updated successfully.'), 400: err('The status value was invalid.'), 401: unauthorized(), 404: err('No such signup.') },
    },
  },
  '/admin/get-profile-reports': {
    get: {
      tags: ['Admin'],
      summary: 'List all profile reports (moderation queue)',
      ...auth,
      responses: { 200: okList('All profile reports fetched successfully.'), 401: unauthorized() },
    },
  },
  '/admin/get-event-reports': {
    get: {
      tags: ['Admin'],
      summary: 'List all event reports (moderation queue)',
      ...auth,
      responses: { 200: okList('All event reports fetched successfully.'), 401: unauthorized() },
    },
  },
  '/admin/action-user-event-report': {
    post: {
      tags: ['Admin'],
      summary: 'Act on a profile/event report (warn/suspend/ban/dismiss/unpublish/delete)',
      ...auth,
      ...body('AdminActionUserEventReport'),
      responses: { 200: ok('Report action taken successfully.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/admin/delete-user-event-report/{id}': {
    delete: {
      tags: ['Admin'],
      summary: 'Delete a profile/event report',
      ...auth,
      parameters: [pathParam('id', 'Report id.')],
      responses: { 200: ok('Report deleted successfully.'), 401: unauthorized() },
    },
  },
  '/admin/get-community-reports': {
    get: {
      tags: ['Admin'],
      summary: 'List all reported community posts (moderation queue)',
      ...auth,
      responses: { 200: okList('Reported posts fetched successfully.'), 401: unauthorized() },
    },
  },
  '/admin/action-community-report': {
    post: {
      tags: ['Admin'],
      summary: 'Act on a reported community post',
      ...auth,
      responses: { 200: ok('Action taken successfully.'), 401: unauthorized() },
    },
  },
  '/admin/delete-community-report/{id}': {
    delete: {
      tags: ['Admin'],
      summary: 'Delete a community report',
      ...auth,
      parameters: [pathParam('id', 'Report id.')],
      responses: { 200: ok('Report deleted successfully.'), 401: unauthorized() },
    },
  },

  // ── Wallets & Payouts ────────────────────────────────────────────────────
  '/admin/wallets': {
    get: {
      tags: ['Admin'],
      summary: 'List organizer wallets, highest pending balance first',
      ...auth,
      parameters: query('AdminPaginated'),
      responses: { 200: ok('Wallets fetched successfully.'), 401: unauthorized() },
    },
  },
  '/admin/payouts': {
    get: {
      tags: ['Admin'],
      summary: 'Per-event payout report (gross sales, fees, organizer earnings, eligibility)',
      description:
        'One row per event with confirmed ticket sales. `payout_status` is holding (not yet past the 7-day hold), ' +
        'eligible (ready for POST /admin/payouts/release), partially_transferred, or transferred.',
      ...auth,
      parameters: query('AdminPaginated'),
      responses: { 200: ok('Payout report fetched successfully.'), 401: unauthorized() },
    },
  },
  '/admin/payouts/organizer-detail': {
    get: {
      tags: ['Admin'],
      summary: "Drill down into one organizer's earnings and payouts",
      description: "Wallet balance plus every creator_earnings split (pending and transferred) and the organizer's full payout history.",
      ...auth,
      parameters: query('AdminOrganizerIdQuery'),
      responses: { 200: ok('Organizer payout detail fetched successfully.'), 400: err('Validation failed.'), 401: unauthorized(), 404: err('Organizer not found.') },
    },
  },
  '/admin/payouts/release': {
    post: {
      tags: ['Admin'],
      summary: "Release an organizer's eligible earnings",
      description:
        'Re-validates eligibility server-side, confirms the organizer\'s Stripe Connect account has completed onboarding, ' +
        'then creates a Payout and calls Stripe\'s Transfer API to move their currently-eligible creator_earnings balance ' +
        'into their connected account. Moves real money — there is no automatic/scheduled release, an admin must trigger it.',
      ...auth,
      ...body('AdminPayoutRelease'),
      responses: { 200: ok('Payout released successfully.'), 400: err('Nothing eligible yet, organizer not Stripe-connected, or the Transfer failed.'), 401: unauthorized() },
    },
  },
  '/admin/payouts/retry': {
    post: {
      tags: ['Admin'],
      summary: 'Retry a failed payout',
      description: "Re-attempts a payout that previously failed at the Stripe Transfer step. The failed attempt made no balance changes, so this re-evaluates the organizer's currently-eligible earnings and creates a fresh Payout.",
      ...auth,
      ...body('AdminPayoutRetry'),
      responses: { 200: ok('Payout retried successfully.'), 400: err('Payout not found, or not in a failed state.'), 401: unauthorized() },
    },
  },
};
