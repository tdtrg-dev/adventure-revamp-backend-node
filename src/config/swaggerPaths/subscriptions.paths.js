const { ok, okList, err, unauthorized, auth, body } = require('./_helpers');

module.exports = {
  '/get-payment-plans': {
    get: {
      tags: ['Subscriptions'],
      summary: 'List payment plans with their cost mappings and features',
      ...auth,
      responses: { 200: okList('Plans fetched.'), 401: unauthorized() },
    },
  },
  '/user-checkout': {
    post: {
      tags: ['Subscriptions'],
      summary: 'Subscribe to a plan (Stripe or free) — activates or renews the subscription',
      ...auth,
      ...body('SubscriptionCheckout'),
      responses: { 201: ok('Subscription activated.'), 400: err('Validation failed or payment error.'), 401: unauthorized() },
    },
  },
  '/get-current-subscription': {
    get: {
      tags: ['Subscriptions'],
      summary: "Get the caller's active subscription, if any",
      ...auth,
      responses: { 200: ok('Subscription fetched (data is null if none active).'), 401: unauthorized() },
    },
  },
};
