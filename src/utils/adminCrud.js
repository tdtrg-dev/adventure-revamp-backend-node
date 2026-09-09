const { adminSuccess, adminError, adminValidationError } = require('./adminResponse');

function validateAdmin(schema, body) {
  const { error, value } = schema.validate(body, { abortEarly: false, convert: true });
  if (!error) return { value };

  const data = {};
  error.details.forEach((d) => {
    const field = d.path.join('.') || 'error';
    if (!data[field]) data[field] = [];
    data[field].push(d.message);
  });
  return { validationErrors: data, message: error.details[0].message };
}

/** Mirrors ApiBaseController::store — {status,data,message} envelope, HTTP 200 throughout (see adminResponse.js). */
function adminStore(Model, { rules, uniqueCheck, beforeCreate }) {
  return async (req, res, next) => {
    try {
      const { value, validationErrors, message } = validateAdmin(rules, req.body);
      if (validationErrors) return adminValidationError(res, validationErrors, message);

      if (uniqueCheck && (await uniqueCheck(value))) {
        return adminError(res, 'This record already exists');
      }

      const doc = await Model.create(beforeCreate ? await beforeCreate(value) : value);
      return adminSuccess(res, doc, 'Record created successfully');
    } catch (e) {
      next(e);
    }
  };
}

/** Mirrors ApiBaseController::update. */
function adminUpdate(Model, { updateRules, uniqueCheckUpdate, beforeUpdate }) {
  return async (req, res, next) => {
    try {
      const { value, validationErrors, message } = validateAdmin(updateRules, req.body);
      if (validationErrors) return adminValidationError(res, validationErrors, message);

      const doc = await Model.findById(req.params.id);
      if (!doc) return adminError(res, 'Record not found');

      if (uniqueCheckUpdate && (await uniqueCheckUpdate(value, req.params.id))) {
        return adminError(res, 'This record already exists');
      }

      const finalValue = beforeUpdate ? await beforeUpdate(value, doc) : value;
      Object.assign(doc, finalValue);
      await doc.save();
      return adminSuccess(res, doc, 'Data updated successfully');
    } catch (e) {
      next(e);
    }
  };
}

/** Mirrors ApiBaseController::show. */
function adminShow(Model) {
  return async (req, res, next) => {
    try {
      const doc = await Model.findById(req.params.id);
      if (!doc) return adminError(res, 'Record not found');
      return adminSuccess(res, doc, 'Record found');
    } catch (e) {
      next(e);
    }
  };
}

/** Mirrors ApiBaseController::destroy. */
function adminDestroy(Model) {
  return async (req, res, next) => {
    try {
      await Model.deleteOne({ _id: req.params.id });
      return adminSuccess(res, [], 'Record deleted successfully');
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { adminStore, adminUpdate, adminShow, adminDestroy, validateAdmin };
