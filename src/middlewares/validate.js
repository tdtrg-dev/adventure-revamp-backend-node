const { error } = require('../utils/response');

/**
 * Mirrors Laravel's dominant validation-failure shape:
 *   Helper::createAPIResponce(true, 400, $validator->errors()->first(), $validator->errors())
 * -> { success:false, code:400, message:'<first error>', data:{ field: ['<error>', ...] } }
 *
 * @param {import('joi').Schema} schema
 * @param {'body'|'query'|'params'} source
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error: validationError, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: false,
      convert: true,
    });

    if (validationError) {
      const data = {};
      validationError.details.forEach((detail) => {
        const field = detail.path.join('.') || 'error';
        if (!data[field]) data[field] = [];
        data[field].push(detail.message);
      });
      const firstMessage = validationError.details[0].message;
      return error(res, firstMessage, 400, data);
    }

    req[source] = value;
    return next();
  };
}

module.exports = validate;