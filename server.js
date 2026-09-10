const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const swaggerUi = require('swagger-ui-express');

const env = require('./src/config/env');
const connectDB = require('./src/config/db');
const { corsOptions } = require('./src/config/cors');
const models = require('./src/models'); // register all schemas before anything else touches Mongoose
const routes = require('./src/routes');
const swaggerSpec = require('./src/config/swagger');
const { notFoundHandler, errorHandler } = require('./src/middlewares/errorHandler');
const { startScheduledJobs } = require('./src/jobs');

const app = express();

// Mounted ahead of helmet() so its CSP never applies here — swagger-ui-express's
// bundled HTML relies on inline scripts/styles that a strict CSP would block.
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Global Security & Input Validation Middlewares
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Strips any request key starting with `$` or containing `.` from body/query/params —
// defense-in-depth against NoSQL operator-injection, on top of Mongoose's own
// sanitizeFilter (config/db.js) and per-field Joi validation.
app.use(mongoSanitize());
// Collapses duplicate query-string keys to their last value (prevents an
// unexpected array reaching code that assumes a scalar) — interest_ids is a
// deliberate repeated-key array (see global-search's OpenAPI docs) so it's exempt.
app.use(hpp({ whitelist: ['interest_ids'] }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use('/uploads', express.static('uploads'));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  await connectDB();

  // Mongoose builds indexes (2dsphere, unique, etc.) in the background by default —
  // without waiting here, a cold-started server could accept a $geoNear/unique-constrained
  // request before its index actually exists on a fresh database and fail unpredictably.
  await Promise.all(Object.values(models).map((model) => model.init()));

  app.listen(env.port, () => {
    console.log(`${env.appName} API listening on port ${env.port}`);
  });

  startScheduledJobs();
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;