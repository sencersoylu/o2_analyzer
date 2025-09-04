const Joi = require('joi');
const logger = require('../utils/logger');

// Chamber validation schema
const chamberSchema = Joi.object({
	name: Joi.string().min(1).max(100).required(),
	description: Joi.string().optional(),
	isActive: Joi.boolean().optional(),
});

// O2 Reading validation schema
const o2ReadingSchema = Joi.object({
	o2Level: Joi.number().min(0).max(100).required(),
	temperature: Joi.number().min(-50).max(100).optional(),
	humidity: Joi.number().min(0).max(100).optional(),
	sensorStatus: Joi.string().valid('normal', 'warning', 'error').optional(),
});

// Alarm validation schema
const alarmSchema = Joi.object({
	type: Joi.string()
		.valid('low_o2', 'high_o2', 'sensor_error', 'calibration_needed')
		.required(),
	severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
	message: Joi.string().required(),
});

// Alarm mute validation schema
const alarmMuteSchema = Joi.object({
	duration: Joi.number().min(1).max(1440).optional(), // minutes
	reason: Joi.string().optional(),
});

// Chamber settings validation schema
const chamberSettingsSchema = Joi.object({
	alarmLevelHigh: Joi.number().min(0).max(100).optional(),
	alarmLevelLow: Joi.number().min(0).max(100).optional(),
	sensorModel: Joi.string().optional(),
	sensorSerialNumber: Joi.string().optional(),
	isCalibrationRequired: Joi.boolean().optional(),
});

// 3-Point Calibration validation schema
const threePointCalibrationSchema = Joi.object({
	zeroPointRaw: Joi.number().required().messages({
		'any.required': 'Zero point raw value is required',
		'number.base': 'Zero point raw value must be a number',
	}),
	midPointRaw: Joi.number().required().messages({
		'any.required': 'Mid point raw value is required',
		'number.base': 'Mid point raw value must be a number',
	}),
	hundredPointRaw: Joi.number().required().messages({
		'any.required': 'Hundred point raw value is required',
		'number.base': 'Hundred point raw value must be a number',
	}),
	midPointCalibrated: Joi.number().min(0).max(100).default(21.0).messages({
		'number.min': 'Mid point calibrated value must be between 0 and 100',
		'number.max': 'Mid point calibrated value must be between 0 and 100',
	}),
	calibratedBy: Joi.string().optional(),
	notes: Joi.string().optional(),
}).custom((value, helpers) => {
	// Custom validation for calibration points order
	const { zeroPointRaw, midPointRaw, hundredPointRaw } = value;

	if (zeroPointRaw >= midPointRaw) {
		return helpers.error('any.invalid', {
			message: 'Zero point raw value must be less than mid point raw value',
		});
	}

	if (midPointRaw >= hundredPointRaw) {
		return helpers.error('any.invalid', {
			message: 'Mid point raw value must be less than hundred point raw value',
		});
	}

	return value;
});

// Raw reading calibration validation schema
const calibrateReadingSchema = Joi.object({
	rawValue: Joi.number().required().messages({
		'any.required': 'Raw value is required',
		'number.base': 'Raw value must be a number',
	}),
});

// Validation middleware functions
const validateChamber = (req, res, next) => {
	const { error } = chamberSchema.validate(req.body);
	if (error) {
		logger.warn('Chamber validation failed:', error.details[0].message);
		return res.status(400).json({
			success: false,
			message: error.details[0].message,
		});
	}
	next();
};

const validateO2Reading = (req, res, next) => {
	const { error } = o2ReadingSchema.validate(req.body);
	if (error) {
		logger.warn('O2 Reading validation failed:', error.details[0].message);
		return res.status(400).json({
			success: false,
			message: error.details[0].message,
		});
	}
	next();
};

const validateAlarm = (req, res, next) => {
	const { error } = alarmSchema.validate(req.body);
	if (error) {
		logger.warn('Alarm validation failed:', error.details[0].message);
		return res.status(400).json({
			success: false,
			message: error.details[0].message,
		});
	}
	next();
};

const validateAlarmMute = (req, res, next) => {
	const { error } = alarmMuteSchema.validate(req.body);
	if (error) {
		logger.warn('Alarm mute validation failed:', error.details[0].message);
		return res.status(400).json({
			success: false,
			message: error.details[0].message,
		});
	}
	next();
};

const validateChamberSettings = (req, res, next) => {
	const { error } = chamberSettingsSchema.validate(req.body);
	if (error) {
		logger.warn(
			'Chamber settings validation failed:',
			error.details[0].message
		);
		return res.status(400).json({
			success: false,
			message: error.details[0].message,
		});
	}
	next();
};

const validateThreePointCalibration = (req, res, next) => {
	const { error } = threePointCalibrationSchema.validate(req.body);
	if (error) {
		logger.warn(
			'3-Point calibration validation failed:',
			error.details[0].message
		);
		return res.status(400).json({
			success: false,
			message: error.details[0].message,
		});
	}
	next();
};

const validateCalibrateReading = (req, res, next) => {
	const { error } = calibrateReadingSchema.validate(req.body);
	if (error) {
		logger.warn(
			'Calibrate reading validation failed:',
			error.details[0].message
		);
		return res.status(400).json({
			success: false,
			message: error.details[0].message,
		});
	}
	next();
};

// Legacy validation for backward compatibility
const validateCalibration = (req, res, next) => {
	return res.status(400).json({
		success: false,
		message: 'Please use 3-point calibration endpoint instead',
	});
};

module.exports = {
	validateChamber,
	validateO2Reading,
	validateAlarm,
	validateAlarmMute,
	validateChamberSettings,
	validateThreePointCalibration,
	validateCalibrateReading,
	validateCalibration, // Legacy
};
