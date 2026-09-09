/**
 * Mirrors Laravel's Helper::createAPIResponce($isError, $code, $message, $data)
 * Wire shape: { success, code, message, data } with HTTP status === code.
 * On success, a null/undefined payload is normalized to [] (matches Laravel's behavior);
 * on error, the payload is sent as-is (Laravel does not apply the same fallback there).
 */
function sendResponse(res, isError, code, message, data) {
  const body = { success: !isError, code, message };
  if (!isError) {
    body.data = data === null || data === undefined ? [] : data;
  } else {
    body.data = data;
  }
  return res.status(code).json(body);
}

function success(res, data, message = 'Success', code = 200) {
  return sendResponse(res, false, code, message, data);
}

function error(res, message = 'Something went wrong', code = 400, data = []) {
  return sendResponse(res, true, code, message, data);
}

module.exports = { sendResponse, success, error };