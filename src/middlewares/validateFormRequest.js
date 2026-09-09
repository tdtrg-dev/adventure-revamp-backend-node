/**
 * The 3 Website endpoints (contact-us, newsletter, park-stay-lead) use Laravel
 * FormRequest classes with no custom failedValidation() override and no global
 * exception reshaping (bootstrap/app.php's withExceptions() is empty) — so their
 * validation failures return Laravel's own default JSON error shape,
 * {message, errors}, HTTP 422. This is a third, genuinely different shape from
 * both the app-wide {success,code,message,data} envelope and the admin CRUD
 * layer's {status,data,message}/{success,data,message} shapes.
 */
function validateFormRequest(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false, convert: true });

    if (error) {
      const errors = {};
      error.details.forEach((d) => {
        const field = d.path.join('.') || 'error';
        if (!errors[field]) errors[field] = [];
        errors[field].push(d.message);
      });

      const count = error.details.length;
      const message = count > 1 ? `${error.details[0].message} (and ${count - 1} more error${count - 1 === 1 ? '' : 's'})` : error.details[0].message;

      return res.status(422).json({ message, errors });
    }

    req[source] = value;
    return next();
  };
}

module.exports = validateFormRequest;
