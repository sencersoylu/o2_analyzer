const { ChamberSettings, Chamber, CalibrationPoints } = require('../models');
const calibrationService = require('../services/calibrationService');
const logger = require('../utils/logger');

// Get socket handler for real-time notifications
const getSocketHandler = () => {
	return global.socketHandler;
};

class SettingsController {
	// Get chamber settings
	async getChamberSettings(req, res) {
		try {
			const { id } = req.params;

			const settings = await ChamberSettings.findOne({
				where: { chamberId: id },
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name', 'description'],
					},
				],
			});

			if (!settings) {
				return res.status(404).json({
					success: false,
					message: 'Chamber settings not found',
				});
			}

			res.json({
				success: true,
				data: settings,
			});
		} catch (error) {
			logger.error('Error getting chamber settings:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Update chamber settings
	async updateChamberSettings(req, res) {
		try {
			const { id } = req.params;
			const {
				alarmLevelHigh,
				alarmLevelLow,
				sensorModel,
				sensorSerialNumber,
				isCalibrationRequired,
			} = req.body;

			const settings = await ChamberSettings.findOne({
				where: { chamberId: id },
			});

			if (!settings) {
				return res.status(404).json({
					success: false,
					message: 'Chamber settings not found',
				});
			}

			// Validate alarm levels
			if (alarmLevelHigh !== undefined && alarmLevelLow !== undefined) {
				if (alarmLevelHigh <= alarmLevelLow) {
					return res.status(400).json({
						success: false,
						message: 'High alarm level must be greater than low alarm level',
					});
				}
			}

			await settings.update({
				alarmLevelHigh:
					alarmLevelHigh !== undefined
						? alarmLevelHigh
						: settings.alarmLevelHigh,
				alarmLevelLow:
					alarmLevelLow !== undefined ? alarmLevelLow : settings.alarmLevelLow,
				sensorModel:
					sensorModel !== undefined ? sensorModel : settings.sensorModel,
				sensorSerialNumber:
					sensorSerialNumber !== undefined
						? sensorSerialNumber
						: settings.sensorSerialNumber,
				isCalibrationRequired:
					isCalibrationRequired !== undefined
						? isCalibrationRequired
						: settings.isCalibrationRequired,
			});

			logger.info(`Chamber settings updated for chamber ${id}`);

			// Broadcast settings update via Socket.IO
			const socketHandler = getSocketHandler();
			if (socketHandler) {
				socketHandler.broadcastSettingsUpdate(id, settings);
			}

			res.json({
				success: true,
				data: settings,
				message: 'Settings updated successfully',
			});
		} catch (error) {
			logger.error('Error updating chamber settings:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Perform 3-point calibration
	async performThreePointCalibration(req, res) {
		try {
			const { id } = req.params;
			const {
				zeroPointRaw,
				midPointRaw,
				hundredPointRaw,
				midPointCalibrated = 21.0,
				calibratedBy,
				notes,
			} = req.body;

			// Validasyon
			if (!zeroPointRaw || !midPointRaw || !hundredPointRaw) {
				return res.status(400).json({
					success: false,
					message:
						'All calibration points (zeroPointRaw, midPointRaw, hundredPointRaw) are required',
				});
			}

			if (zeroPointRaw >= midPointRaw || midPointRaw >= hundredPointRaw) {
				return res.status(400).json({
					success: false,
					message:
						'Calibration points must be in ascending order: zeroPointRaw < midPointRaw < hundredPointRaw',
				});
			}

			const result = await calibrationService.performThreePointCalibration(
				parseInt(id),
				{
					zeroPointRaw: parseFloat(zeroPointRaw),
					midPointRaw: parseFloat(midPointRaw),
					hundredPointRaw: parseFloat(hundredPointRaw),
					midPointCalibrated: parseFloat(midPointCalibrated),
				},
				calibratedBy || 'system',
				notes
			);

			// Broadcast calibration event via Socket.IO
			const socketHandler = getSocketHandler();
			if (socketHandler) {
				socketHandler.broadcastCalibration(id, result);
			}

			res.json({
				success: true,
				data: result,
				message: '3-point calibration performed successfully',
			});
		} catch (error) {
			logger.error('Error performing 3-point calibration:', error);

			if (error.message === 'Chamber settings not found') {
				return res.status(404).json({
					success: false,
					message: 'Chamber settings not found',
				});
			}

			res.status(500).json({
				success: false,
				message: error.message || 'Internal server error',
			});
		}
	}

	// Get active calibration points
	async getActiveCalibrationPoints(req, res) {
		try {
			const { id } = req.params;

			const calibrationPoints =
				await calibrationService.getActiveCalibrationPoints(parseInt(id));

			res.json({
				success: true,
				data: calibrationPoints,
			});
		} catch (error) {
			logger.error('Error getting active calibration points:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Calibrate a raw sensor reading
	async calibrateReading(req, res) {
		try {
			const { id } = req.params;
			const { rawValue } = req.body;

			if (rawValue === undefined || rawValue === null) {
				return res.status(400).json({
					success: false,
					message: 'rawValue is required',
				});
			}

			const calibratedValue = await calibrationService.calibrateReading(
				parseInt(id),
				parseFloat(rawValue)
			);

			res.json({
				success: true,
				data: {
					rawValue: parseFloat(rawValue),
					calibratedValue: calibratedValue,
					chamberId: parseInt(id),
				},
			});
		} catch (error) {
			logger.error('Error calibrating reading:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Record sensor change
	async recordSensorChange(req, res) {
		try {
			const { id } = req.params;
			const { sensorModel, sensorSerialNumber } = req.body;

			if (!sensorModel || !sensorSerialNumber) {
				return res.status(400).json({
					success: false,
					message: 'Sensor model and serial number are required',
				});
			}

			const settings = await calibrationService.recordSensorChange(
				parseInt(id),
				sensorModel,
				sensorSerialNumber
			);

			res.json({
				success: true,
				data: settings,
				message: 'Sensor change recorded successfully',
			});
		} catch (error) {
			logger.error('Error recording sensor change:', error);

			if (error.message === 'Chamber settings not found') {
				return res.status(404).json({
					success: false,
					message: 'Chamber settings not found',
				});
			}

			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Get calibration history
	async getCalibrationHistory(req, res) {
		try {
			const { id } = req.params;
			const { limit = 50 } = req.query;

			const history = await calibrationService.getCalibrationHistory(
				parseInt(id),
				parseInt(limit)
			);

			res.json({
				success: true,
				data: history,
				count: history.length,
			});
		} catch (error) {
			logger.error('Error getting calibration history:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Check calibration status
	async checkCalibrationStatus(req, res) {
		try {
			const { id } = req.params;

			const status = await calibrationService.checkCalibrationStatus(
				parseInt(id)
			);

			res.json({
				success: true,
				data: status,
			});
		} catch (error) {
			logger.error('Error checking calibration status:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Mark calibration as required
	async markCalibrationRequired(req, res) {
		try {
			const { id } = req.params;
			const { reason } = req.body;

			const settings = await calibrationService.markCalibrationRequired(
				parseInt(id),
				reason
			);

			res.json({
				success: true,
				data: settings,
				message: 'Calibration marked as required',
			});
		} catch (error) {
			logger.error('Error marking calibration required:', error);

			if (error.message === 'Chamber settings not found') {
				return res.status(404).json({
					success: false,
					message: 'Chamber settings not found',
				});
			}

			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Get calibration statistics
	async getCalibrationStats(req, res) {
		try {
			const { chamberId, days = 30 } = req.query;

			const stats = await calibrationService.getCalibrationStats(
				chamberId ? parseInt(chamberId) : null,
				parseInt(days)
			);

			res.json({
				success: true,
				data: stats,
			});
		} catch (error) {
			logger.error('Error getting calibration stats:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Eski metodları uyumluluk için koruyoruz
	async performCalibration(req, res) {
		return res.status(400).json({
			success: false,
			message:
				'Please use /calibrate-three-point endpoint for 3-point calibration',
		});
	}
}

module.exports = new SettingsController();
