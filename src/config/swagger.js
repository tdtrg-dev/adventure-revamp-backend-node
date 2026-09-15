const validatorSchemas = require('./swaggerSchemas');
const paths = require('./swaggerPaths');
const env = require('./env');

/**
 * Shared response-envelope schemas — the Node port replicates 5 distinct shapes
 * that exist in the real Laravel app (see project memory for the full history):
 *  - ApiResponse / ApiError: the standard `{success, code, message, data}` envelope
 *    used by ~95% of endpoints (HTTP status === `code`).
 *  - AdminResponse / AdminValidationError: the generic admin-CRUD envelope
 *    (`{status, data, message}`, HTTP 200 even on server errors — a real upstream
 *    Laravel bug, replicated on purpose).
 *  - AdminListResponse: 6 admin "index" endpoints that bypass the generic CRUD
 *    layer (`{success, message, data, errors}`).
 *  - WebsiteValidationError: the 3 public website-form endpoints, which get
 *    Laravel's raw default FormRequest 422 shape (`{message, errors}`, no
 *    `success`/`code` keys at all).
 *  - PusherAuthResponse / RawMessage: POST /broadcasting/auth, Laravel's
 *    framework-native (not Helper::createAPIResponce-based) route — success is
 *    Pusher's own `{auth}` payload, failures are Laravel's raw default
 *    exception JSON (`{message}`), not this app's usual envelope at all.
 */
const envelopeSchemas = {
  ApiResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      code: { type: 'integer', example: 200 },
      message: { type: 'string', example: 'Success' },
      data: { type: 'object' },
    },
  },
  ApiListResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      code: { type: 'integer', example: 200 },
      message: { type: 'string', example: 'Success' },
      data: { type: 'array', items: { type: 'object' } },
    },
  },
  ApiError: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      code: { type: 'integer', example: 400 },
      message: { type: 'string', example: 'Something went wrong' },
      data: {
        description: 'Field-keyed validation errors (object), or [] for non-validation failures.',
        oneOf: [{ type: 'object' }, { type: 'array', items: {} }],
      },
    },
  },
  AdminResponse: {
    type: 'object',
    properties: {
      status: { type: 'boolean', example: true },
      data: { type: 'object' },
      message: { type: 'string', example: 'Record created successfully' },
    },
  },
  AdminValidationError: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      data: { type: 'object', description: 'Field-keyed validation errors.' },
      message: { type: 'string' },
    },
  },
  AdminListResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' },
      data: { type: 'array', items: { type: 'object' } },
      errors: { type: 'object' },
    },
  },
  WebsiteValidationError: {
    type: 'object',
    properties: {
      message: { type: 'string', example: 'The email field is required.' },
      errors: { type: 'object' },
    },
  },
  PusherAuthResponse: {
    type: 'object',
    description: "Pusher's own private-channel auth payload — passed straight through, not wrapped.",
    properties: {
      auth: { type: 'string', example: 'app-key:8d9c545cda9ef10194122e208b299e6a06071900989b2e0ff0358da265c8bc9f' },
    },
  },
  RawMessage: {
    type: 'object',
    description: "Laravel's raw default exception JSON — no `success`/`code`/`data` keys.",
    properties: {
      message: { type: 'string' },
    },
  },
};

const entitySchemas = {
  EventListItem: {
    type: 'object',
    properties: {
      event_id: { type: 'string', nullable: true, example: '64f1a2b3c4d5e6f7a8b9c0d1' },
      source: { type: 'string', enum: ['addventure', 'ticketmaster'], example: 'addventure' },
      external_id: { type: 'string', nullable: true },
      booking_url: { type: 'string', nullable: true },
      event_name: { type: 'string', example: 'Sunrise Hike at Table Mountain' },
      event_image: { type: 'string', nullable: true },
      description: { type: 'string', nullable: true },
      start_date: { type: 'string', format: 'date', example: '2026-08-14' },
      end_date: { type: 'string', format: 'date', example: '2026-08-14' },
      location: { type: 'string', nullable: true },
      location_lat: { type: 'number', nullable: true },
      location_long: { type: 'number', nullable: true },
      distance_km: { type: 'integer', nullable: true },
      starting_price: { type: 'string', example: '25.00' },
      rating: {
        type: 'object',
        properties: { avg: { type: 'number', example: 4.5 }, count: { type: 'integer', example: 12 } },
      },
      interests: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' } } } },
    },
  },
  User: {
    type: 'object',
    properties: {
      id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      user_type: { type: 'string', enum: ['user', 'admin'] },
      gender: { type: 'string', nullable: true },
      dob: { type: 'string', format: 'date', nullable: true },
      phone: { type: 'string', nullable: true },
      image: { type: 'string', nullable: true },
      bio: { type: 'string', nullable: true },
      radius: { type: 'number', nullable: true },
    },
  },
  TicketBooking: {
    type: 'object',
    properties: {
      booking_id: { type: 'string' },
      invoice_number: { type: 'string' },
      status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled', 'refunded', 'used'] },
      total_amount: { type: 'number' },
      currency: { type: 'string', example: 'USD' },
      qr_token: { type: 'string' },
    },
  },
};

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Addventure API',
    version: '1.0.0',
    description:
      'Node.js/Express/MongoDB port of the Addventure backend (events/ticketing + social community + chat). ' +
      'Every endpoint that is not part of the public/website module requires a JWT bearer token (shared guard ' +
      'between regular users and admins, matching the original Laravel app). See project docs for the full ' +
      'migration history and the 4 distinct response envelope shapes this API replicates on purpose.',
  },
  servers: [{ url: `${env.appUrl || ''}/api`, description: 'API server' }],
  tags: [
    { name: 'Broadcasting' },
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Onboarding' },
    { name: 'Presence' },
    { name: 'Taxonomy' },
    { name: 'Events' },
    { name: 'Bookings' },
    { name: 'Subscriptions' },
    { name: 'Notifications' },
    { name: 'Community' },
    { name: 'Connections' },
    { name: 'Chat' },
    { name: 'Dashboard' },
    { name: 'Website' },
    { name: 'Public' },
    { name: 'Admin' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: { ...envelopeSchemas, ...entitySchemas, ...validatorSchemas },
  },
  paths,
};

module.exports = spec;
