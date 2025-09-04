const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Analytics & Reports
router.get('/dashboard', analyticsController.getDashboardData);
router.get('/trends', analyticsController.getO2Trends);
router.get(
	'/reports/calibration-history',
	analyticsController.getCalibrationReports
);
router.get(
	'/reports/alarm-summary',
	analyticsController.getAlarmSummaryReports
);

module.exports = router;
