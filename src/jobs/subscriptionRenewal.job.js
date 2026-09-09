const UserSubscription = require('../models/UserSubscription');
const PaymentPlan = require('../models/PaymentPlan');
const User = require('../models/User');
const { getStripeClient } = require('../integrations/stripe');
const subscriptionService = require('../services/subscription.service');
const env = require('../config/env');

async function markExpired(subscription, reason) {
  subscription.status = 'expired';
  subscription.auto_renew = false;
  subscription.cancellation_reason = reason;
  subscription.cancelled_at = new Date();
  await subscription.save();
}

/** Mirrors the `subscriptions:renew` artisan command (scheduled daily @ 00:00). */
async function renewExpiredSubscriptions({ dryRun = false } = {}) {
  const expired = await UserSubscription.find({
    status: 'active',
    auto_renew: true,
    gateway: { $ne: 'free' },
    ends_at: { $lte: new Date() },
  });

  const summary = { total: expired.length, renewed: 0, failed: 0, skipped: 0 };
  if (expired.length === 0) {
    console.log('subscriptions:renew — no subscriptions due for renewal.');
    return summary;
  }

  console.log(`subscriptions:renew — found ${expired.length} subscription(s) due for renewal.${dryRun ? ' [DRY RUN]' : ''}`);

  for (const subscription of expired) {
    const user = await User.findById(subscription.user_id).select('name email stripe_customer_id');
    const plan = await PaymentPlan.findOne({ 'cost_mappings._id': subscription.plan_cost_mapping_id });
    const mapping = plan?.cost_mappings.id(subscription.plan_cost_mapping_id);

    if (!user?.stripe_customer_id) {
      console.warn(`  subscription ${subscription.id}: no stripe_customer_id — skipping.`);
      if (!dryRun) await markExpired(subscription, 'No Stripe customer ID on file.');
      summary.skipped++;
      continue;
    }

    if (!mapping || mapping.price <= 0) {
      console.warn(`  subscription ${subscription.id}: plan price is 0 — skipping (should use free gateway).`);
      summary.skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY RUN] would charge ${mapping.price} to ${user.stripe_customer_id}`);
      summary.renewed++;
      continue;
    }

    try {
      const stripe = getStripeClient();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(mapping.price * 100),
        currency: (env.payment.defaultCurrency || 'usd').toLowerCase(),
        customer: user.stripe_customer_id,
        payment_method_types: ['card'],
        confirm: true,
        off_session: true,
        description: `Auto-renewal for subscription #${subscription.id}`,
        metadata: { subscription_id: subscription.id, user_id: user.id, renewal: true },
      });

      const result = await subscriptionService.renew(subscription, paymentIntent.id);
      console.log(`  renewed -> subscription ${result.subscription.id} | invoice ${result.invoice}`);
      summary.renewed++;
    } catch (e) {
      const reason = e.type === 'StripeCardError' ? `Card declined: ${e.message}` : e.message;
      console.error(`  subscription ${subscription.id} renewal failed: ${reason}`);
      await markExpired(subscription, reason);
      summary.failed++;
    }
  }

  console.log(`subscriptions:renew — total=${summary.total} renewed=${summary.renewed} failed=${summary.failed} skipped=${summary.skipped}`);
  return summary;
}

module.exports = { renewExpiredSubscriptions };
