const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/dashboard.validators');
const controller = require('../controllers/dashboard.controller');

router.post('/dashboard-stat', authenticate, validate(v.getDashboard, 'body'), controller.getDashboard);

module.exports = router;
