require('dotenv').config();

module.exports = {
  appName: process.env.APP_NAME || 'Addventure',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 8000,
  appUrl: process.env.APP_URL || 'http://localhost:8000',
  frontendUrl: process.env.FRONTEND_URL,

  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/addventure',

  payment: {
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
    platformAdminId: process.env.PLATFORM_ADMIN_ID || null,
  },

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '90d',

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirect: process.env.GOOGLE_REDIRECT,
    mapKey: process.env.GOOGLE_MAP_KEY,
  },
  facebook: {
    clientId: process.env.FB_CLIENT_ID,
    clientSecret: process.env.FB_CLIENT_SECRET,
    callbackRedirect: process.env.FB_CALLBACK_REDIRECTS,
  },

  stripe: {
    key: process.env.STRIPE_KEY,
    secret: process.env.STRIPE_SECRET,
  },

  pusher: {
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_APP_KEY,
    secret: process.env.PUSHER_APP_SECRET,
    cluster: process.env.PUSHER_APP_CLUSTER,
    host: process.env.PUSHER_HOST,
    port: process.env.PUSHER_PORT,
    scheme: process.env.PUSHER_SCHEME || 'https',
  },

  firebase: {
    credentials: process.env.FIREBASE_CREDENTIALS,
    projectId: process.env.FIREBASE_PROJECT_ID,
  },

  mailgun: {
    secret: process.env.MAILGUN_SECRET,
    domain: process.env.MAILGUN_DOMAIN || 'mailbox.add-venture.co',
    endpoint: process.env.MAILGUN_ENDPOINT || 'https://api.mailgun.net',
    fromEmail: process.env.MAIL_FROM_ADDRESS || 'no-reply@addventure.co',
    fromName: process.env.MAIL_FROM_NAME || 'Addventure',
  },

  ticketmaster: {
    enabled: process.env.TICKETMASTER_ENABLED === 'true',
    apiKey: process.env.TICKETMASTER_API_KEY,
  },
};

// Fail fast at boot rather than crash confusingly on the first login/signup call,
// or — worse — silently accept a trivially guessable secret that lets an attacker
// forge valid JWTs for any user/admin id.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  throw new Error('JWT_SECRET is missing or too short — set a random string of at least 16 characters.');
}