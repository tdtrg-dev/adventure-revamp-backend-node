const { error } = require('../utils/response');

function notFoundHandler(req, res, next) {
  return error(res, 'Route not found', 404, []);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const code = err.statusCode || 500;
  if (code >= 500) {
    console.error(err);
  }

  if (err.name === 'ValidationError' && err.errors) {
    // Mongoose validation error
    const data = {};
    Object.keys(err.errors).forEach((field) => {
      data[field] = [err.errors[field].message];
    });
    return error(res, err.message, 400, data);
  }

  if (err.name === 'CastError') {
    return error(res, `Invalid value for ${err.path}`, 400, []);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return error(res, `${field} already exists`, 409, []);
  }

  const message = err.message || 'Server Error';
  return error(res, message, code, err.data || []);
}

module.exports = { notFoundHandler, errorHandler };
