/**
 * The admin CRUD layer (ApiBaseController-derived resources in Laravel) uses a
 * genuinely different, less consistent contract than the rest of the app:
 *   - success/business-error: {status, data, message} — no `code` key, HTTP 200
 *     even for business-rule rejections (a real quirk: Helper::exception() calls
 *     serverError() which tries to pass a 500 status through a function that only
 *     accepts one parameter — the extra args are silently dropped in PHP, so the
 *     intended 500 never happens). Replicated faithfully since it's consistent
 *     and live across ~10 admin resources, not a one-off dead-code accident.
 *   - validation error: {success, data: errors, message} — HTTP 422, via a
 *     different Laravel helper (Helper::validationError) than the one above.
 */
function adminSuccess(res, data, message = 'Record found') {
  return res.status(200).json({ status: true, data: data === undefined ? null : data, message });
}

function adminError(res, message = 'Error', code = 200) {
  return res.status(code).json({ status: false, message });
}

function adminValidationError(res, errors, message) {
  const firstMessage = message || Object.values(errors)[0]?.[0] || 'Validation failed';
  return res.status(422).json({ success: false, data: errors, message: firstMessage });
}

/**
 * A handful of admin index() overrides bypass the {status,...} shape entirely and
 * return a raw RepositoryHelper-style array — {success, message, data, errors},
 * always HTTP 200 for the plain `repository->all()` case, or 200/400 keyed off the
 * repo call's own success flag for the ones with real filter/pagination logic.
 */
function adminListBypass(res, data, message = 'Records found', success = true) {
  return res.status(success ? 200 : 400).json({ success, message, data, errors: success ? null : data });
}

module.exports = { adminSuccess, adminError, adminValidationError, adminListBypass };
