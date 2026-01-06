const express = require('express');
const router = express.Router();
const plcController = require('../controllers/plcController');
const { body, param, query } = require('express-validator');
const validation = require('../middleware/validation');

/**
 * @route   GET /api/plc/raw-values
 * @desc    Read all raw values from PLC register R02000
 * @access  Public
 * @query   numValues - Number of values to read (1-50, default: 19)
 */
router.get(
	'/raw-values',
	[
		query('numValues')
			.optional()
			.isInt({ min: 1, max: 50 })
			.withMessage('numValues must be an integer between 1 and 50'),
	],
	validation.handleValidationErrors,
	plcController.readRawValues
);

/**
 * @route   GET /api/plc/sensor/:sensorIndex
 * @desc    Read a specific sensor value by index
 * @access  Public
 * @param   sensorIndex - Index of the sensor (0-based)
 */
router.get(
	'/sensor/:sensorIndex',
	[
		param('sensorIndex')
			.isInt({ min: 0 })
			.withMessage('sensorIndex must be a non-negative integer'),
	],
	validation.handleValidationErrors,
	plcController.readSensorValue
);

/**
 * @route   GET /api/plc/status
 * @desc    Get PLC connection status
 * @access  Public
 */
router.get('/status', plcController.getConnectionStatus);

/**
 * @route   GET /api/plc/chamber/:chamberId/sensors
 * @desc    Read chamber-specific sensor values
 * @access  Public
 * @param   chamberId - Chamber ID (1 for Main, 2 for Entry)
 */
router.get(
	'/chamber/:chamberId/sensors',
	[
		param('chamberId')
			.isIn(['1', '2'])
			.withMessage('chamberId must be 1 (Main) or 2 (Entry)'),
	],
	validation.handleValidationErrors,
	plcController.readChamberSensors
);

/**
 * @route   POST /api/plc/convert-raw-to-o2
 * @desc    Convert raw sensor value to O2 percentage
 * @access  Public
 * @body    rawValue, minRaw, maxRaw, minO2, maxO2
 */
router.post(
	'/convert-raw-to-o2',
	[
		body('rawValue').isNumeric().withMessage('rawValue must be a number'),
		body('minRaw')
			.optional()
			.isNumeric()
			.withMessage('minRaw must be a number'),
		body('maxRaw')
			.optional()
			.isNumeric()
			.withMessage('maxRaw must be a number'),
		body('minO2').optional().isNumeric().withMessage('minO2 must be a number'),
		body('maxO2').optional().isNumeric().withMessage('maxO2 must be a number'),
	],
	validation.handleValidationErrors,
	plcController.convertRawToO2
);

/**
 * @route   GET /api/plc/periodic-reader/status
 * @desc    Get periodic PLC reader status
 * @access  Public
 */
router.get('/periodic-reader/status', plcController.getPeriodicReaderStatus);

/**
 * @route   POST /api/plc/periodic-reader/start
 * @desc    Start periodic PLC reader
 * @access  Public
 */
router.post('/periodic-reader/start', plcController.startPeriodicReader);

/**
 * @route   POST /api/plc/periodic-reader/stop
 * @desc    Stop periodic PLC reader
 * @access  Public
 */
router.post('/periodic-reader/stop', plcController.stopPeriodicReader);

/**
 * @route   POST /api/plc/periodic-reader/interval
 * @desc    Update periodic PLC reader interval
 * @access  Public
 * @body    interval - New interval in milliseconds (minimum 100)
 */
router.post(
	'/periodic-reader/interval',
	[
		body('interval')
			.isInt({ min: 100 })
			.withMessage('interval must be an integer >= 100 milliseconds'),
	],
	validation.handleValidationErrors,
	plcController.updatePeriodicReaderInterval
);

/**
 * @route   GET /api/plc/health
 * @desc    PLC service health check
 * @access  Public
 */
router.get('/health', (req, res) => {
	res.json({
		success: true,
		message: 'PLC service is running',
		service: 'PLC Service v1.0.0',
		timestamp: new Date().toISOString(),
	});
});

module.exports = router;
