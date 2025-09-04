const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const {
	validateChamberSettings,
	validateThreePointCalibration,
} = require('../middleware/validation');

// Settings Management
router.get('/:id', settingsController.getChamberSettings);
router.put(
	'/:id',
	validateChamberSettings,
	settingsController.updateChamberSettings
);

// 3-Point Calibration Management
router.post(
	'/:id/calibrate-three-point',
	validateThreePointCalibration,
	settingsController.performThreePointCalibration
);
router.get(
	'/:id/calibration-points',
	settingsController.getActiveCalibrationPoints
);
router.post('/:id/calibrate-reading', settingsController.calibrateReading);

// Legacy calibration endpoint (for backward compatibility)
router.post('/:id/calibrate', settingsController.performCalibration);

// Sensor Management
router.post('/:id/sensor-changed', settingsController.recordSensorChange);
router.get(
	'/:id/calibration-history',
	settingsController.getCalibrationHistory
);
router.get(
	'/:id/calibration-status',
	settingsController.checkCalibrationStatus
);
router.post(
	'/:id/calibration-required',
	settingsController.markCalibrationRequired
);

// Calibration Statistics
router.get('/calibration/stats', settingsController.getCalibrationStats);

module.exports = router;
