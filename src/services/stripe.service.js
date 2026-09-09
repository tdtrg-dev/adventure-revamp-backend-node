const { getStripeClient } = require('../integrations/stripe');
const User = require('../models/User');
const env = require('../config/env');

function notFound(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

async function createPaymentIntent(amount) {
  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
  });
  return paymentIntent.client_secret;
}

async function configureStripe(userId, origin) {
  const user = await User.findById(userId);
  if (!user) throw notFound('Invalid user id.');

  const stripe = getStripeClient();
  const account = await stripe.accounts.create({
    type: 'express',
    capabilities: { transfers: { requested: true } },
  });

  user.stripe_account_id = account.id;
  await user.save();

  const base = (origin || env.frontendUrl || 'http://localhost:5173').replace(/\/$/, '');
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${base}/event/cancel-connect-account`,
    return_url: `${base}/event/success-connect-account`,
    type: 'account_onboarding',
  });

  return accountLink.url;
}

module.exports = { createPaymentIntent, configureStripe };
