const express = require('express');
const router = express.Router();

router.use(require('./auth.routes'));
router.use(require('./lookups.routes'));
router.use(require('./plans.routes'));
router.use(require('./misc.routes'));

module.exports = router;
