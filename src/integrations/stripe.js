const Stripe = require('stripe');
const env = require('../config/env');

let client = null;

/**
 * Lazily constructs the Stripe client on first real use. The Stripe SDK throws
 * immediately at construction if no API key is set — constructing it eagerly at
 * module-load time would crash the whole server on boot whenever STRIPE_SECRET
 * isn't configured (e.g. local dev without Stripe set up yet), even for requests
 * that never touch Stripe.
 */
function getStripeClient() {
  if (!env.stripe.secret) {
    const err = new Error('Stripe is not configured (STRIPE_SECRET missing).');
    err.statusCode = 500;
    throw err;
  }
  if (!client) client = new Stripe(env.stripe.secret);
  return client;
}

module.exports = { getStripeClient };
