const cron = require('node-cron');
const presenceService = require('../services/presence.service');
const { renewExpiredSubscriptions } = require('./subscriptionRenewal.job');

/** Registers the same two scheduled tasks Laravel ran via its scheduler (routes/console.php). */
function startScheduledJobs() {
  // presence:sweep — every minute
  cron.schedule('* * * * *', async () => {
    try {
      await presenceService.markStaleUsersOffline();
    } catch (e) {
      console.error('presence:sweep failed:', e.message);
    }
  });

  // subscriptions:renew — daily @ 00:00
  cron.schedule('0 0 * * *', async () => {
    try {
      await renewExpiredSubscriptions();
    } catch (e) {
      console.error('subscriptions:renew failed:', e.message);
    }
  });

  console.log('Scheduled jobs registered: presence:sweep (every minute), subscriptions:renew (daily @ 00:00).');
}

module.exports = { startScheduledJobs };
