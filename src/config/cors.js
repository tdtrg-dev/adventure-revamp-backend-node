const env = require('./env');

// Browsers send the Origin header without a trailing slash and lower-cased, so
// every configured value is normalised the same way before comparison —
// otherwise "http://localhost:5173/" copied from a browser bar never matches.
function normalize(origin) {
  return String(origin).trim().toLowerCase().replace(/\/+$/, '');
}

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://172.16.0.151:5173',
];

// CORS_ORIGINS is a comma-separated list; FRONTEND_URL/APP_URL are folded in so a
// deployment that already sets them doesn't have to repeat itself.
const configured = (process.env.CORS_ORIGINS || '')
  .split(',')
  .concat([env.frontendUrl, env.appUrl])
  .filter(Boolean);

const allowlist = new Set([...DEFAULT_ORIGINS, ...configured].map(normalize));

const corsOptions = {
  origin(origin, callback) {
    // No Origin header at all — same-origin requests, curl, native mobile apps
    // and the bundled Swagger UI. There is no cross-site risk to gate here.
    if (!origin) return callback(null, true);

    if (allowlist.has(normalize(origin))) return callback(null, true);

    // Answer without the Allow-Origin header rather than throwing: the browser
    // still blocks the call, but the server logs a clear reason instead of the
    // error handler turning a routine rejection into a 500.
    console.warn(`CORS: blocked origin ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After'],
  maxAge: 86400,
};

module.exports = { corsOptions, allowlist };
