const axios = require('axios');
const env = require('../config/env');

/**
 * Mirrors EmailTrait::sendEmailViaMailGun — raw HTTP call to Mailgun's v3 messages API,
 * same auth scheme (basic auth, "api:<secret>") and endpoint shape as the Laravel app.
 * Fire-and-forget from callers (async, logged on failure) — same reliability tier as
 * Laravel's `database` queue driver had in practice (see plan's "Background jobs" note).
 */
async function sendEmailViaMailgun(to, subject, htmlContent) {
  if (!env.mailgun.secret) {
    console.error('Mailgun send aborted: MAILGUN_SECRET is not configured.');
    return;
  }

  const url = `${env.mailgun.endpoint.replace(/\/$/, '')}/v3/${env.mailgun.domain}/messages`;

  try {
    await axios.post(
      url,
      new URLSearchParams({
        from: `${env.mailgun.fromName} <${env.mailgun.fromEmail}>`,
        to,
        subject,
        html: htmlContent,
      }),
      { auth: { username: 'api', password: env.mailgun.secret } }
    );
    console.log(`Mailgun email sent to ${to}`);
  } catch (e) {
    console.error(`Mailgun send failed: ${e.message}`);
  }
}

module.exports = { sendEmailViaMailgun };
