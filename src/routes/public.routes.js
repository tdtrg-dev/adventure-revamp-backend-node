const express = require('express');
const router = express.Router();

const validate = require('../middlewares/validate');
const v = require('../validators/public.validators');
const controller = require('../controllers/public.controller');

router.get('/global-search', validate(v.globalSearch, 'query'), v.requireLatLngTogether, controller.globalSearch);
router.post('/global-search', validate(v.globalSearch, 'body'), v.requireLatLngTogether, controller.globalSearch);

router.get('/dashboard-data', validate(v.dashboardData, 'query'), v.requireLatLngTogether, controller.dashboardData);
router.post('/dashboard-data', validate(v.dashboardData, 'body'), v.requireLatLngTogether, controller.dashboardData);

router.get('/event-detail', validate(v.eventDetail, 'query'), controller.eventDetail);

router.get('/categories', controller.categories);

module.exports = router;
