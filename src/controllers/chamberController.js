const {
	Chamber,
	O2Reading,
	ChamberSettings,
	CalibrationPoints,
} = require('../models');
const calibrationService = require('../services/calibrationService');
const logger = require('../utils/logger');

// Get socket handler for real-time notifications
const getSocketHandler = () => {
	return global.socketHandler;
};

class ChamberController {
	// Get all chambers (only Main and Entry)
	async getAllChambers(req, res) {
		try {
			const chambers = await Chamber.findAll({
				order: [['id', 'ASC']],
			});

			res.json({
				success: true,
				data: chambers,
				count: chambers.length,
			});
		} catch (error) {
			logger.error('Error getting chambers:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Get chamber by ID
	async getChamberById(req, res) {
		try {
			const { id } = req.params;

			const chamber = await Chamber.findByPk(id, {
				include: [
					{
						model: ChamberSettings,
						as: 'settings',
					},
					{
						model: CalibrationPoints,
						as: 'calibrationPoints',
						where: { isActive: true },
						required: false,
					},
				],
			});

			if (!chamber) {
				return res.status(404).json({
					success: false,
					message: 'Chamber not found',
				});
			}

			res.json({
				success: true,
				data: chamber,
			});
		} catch (error) {
			logger.error('Error getting chamber by ID:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Create chamber (disabled - only Main and Entry are allowed)
	async createChamber(req, res) {
		return res.status(403).json({
			success: false,
			message:
				'Chamber creation is disabled. Only Main and Entry chambers are allowed.',
		});
	}

	// Update chamber (limited to allowed fields)
	async updateChamber(req, res) {
		try {
			const { id } = req.params;
			const { description } = req.body;

			const chamber = await Chamber.findByPk(id);

			if (!chamber) {
				return res.status(404).json({
					success: false,
					message: 'Chamber not found',
				});
			}

			// Only allow updating description
			await chamber.update({
				description: description || chamber.description,
			});

			logger.info(`Chamber ${id} updated`);

			res.json({
				success: true,
				data: chamber,
				message: 'Chamber updated successfully',
			});
		} catch (error) {
			logger.error('Error updating chamber:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Delete chamber (disabled)
	async deleteChamber(req, res) {
		return res.status(403).json({
			success: false,
			message:
				'Chamber deletion is disabled. Main and Entry chambers cannot be deleted.',
		});
	}

	// Update high alarm level
	async updateHighAlarmLevel(req, res) {
		try {
			const { id } = req.params;
			const { alarmLevelHigh } = req.body;

			// Validate required field
			if (alarmLevelHigh === undefined || alarmLevelHigh === null) {
				return res.status(400).json({
					success: false,
					message: 'alarmLevelHigh is required',
				});
			}

			// Validate value range
			if (alarmLevelHigh < 0 || alarmLevelHigh > 100) {
				return res.status(400).json({
					success: false,
					message: 'alarmLevelHigh must be between 0 and 100',
				});
			}

			const chamber = await Chamber.findByPk(id);

			if (!chamber) {
				return res.status(404).json({
					success: false,
					message: 'Chamber not found',
				});
			}

			// Validate that high alarm level is greater than low alarm level
			if (alarmLevelHigh <= chamber.alarmLevelLow) {
				return res.status(400).json({
					success: false,
					message: `High alarm level (${alarmLevelHigh}) must be greater than low alarm level (${chamber.alarmLevelLow})`,
				});
			}

			// Update only the high alarm level
			await chamber.update({
				alarmLevelHigh: parseFloat(alarmLevelHigh),
			});

			logger.info(
				`Chamber ${id} high alarm level updated to ${alarmLevelHigh}%`
			);
			res.json({
				success: true,
				data: {
					id: chamber.id,
					name: chamber.name,
					alarmLevelHigh: parseFloat(alarmLevelHigh),
					alarmLevelLow: chamber.alarmLevelLow,
				},
				message: 'High alarm level updated successfully',
			});
		} catch (error) {
			logger.error('Error updating high alarm level:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Get chamber readings
	async getChamberReadings(req, res) {
		try {
			const { id } = req.params;
			const { limit = 100, offset = 0 } = req.query;

			const readings = await O2Reading.findAll({
				where: { chamberId: id },
				order: [['timestamp', 'DESC']],
				limit: parseInt(limit),
				offset: parseInt(offset),
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name'],
					},
				],
			});

			res.json({
				success: true,
				data: readings,
				count: readings.length,
			});
		} catch (error) {
			logger.error('Error getting chamber readings:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Get latest reading
	async getLatestReading(req, res) {
		try {
			const { id } = req.params;

			const reading = await O2Reading.findOne({
				where: { chamberId: id },
				order: [['timestamp', 'DESC']],
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name'],
					},
				],
			});

			if (!reading) {
				return res.status(404).json({
					success: false,
					message: 'No readings found for this chamber',
				});
			}

			res.json({
				success: true,
				data: reading,
			});
		} catch (error) {
			logger.error('Error getting latest reading:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Add reading (with automatic calibration)
	async addReading(req, res) {
		try {
			const { id } = req.params;
			const {
				o2Level,
				temperature,
				humidity,
				sensorStatus = 'normal',
			} = req.body;

			// Validate chamber exists
			const chamber = await Chamber.findByPk(id);
			if (!chamber) {
				return res.status(404).json({
					success: false,
					message: 'Chamber not found',
				});
			}

			// Calibrate the O2 reading
			const calibratedO2Level = await calibrationService.calibrateReading(
				id,
				o2Level
			);

			// Create the reading with calibrated value
			const reading = await O2Reading.create({
				chamberId: id,
				o2Level: calibratedO2Level,
				temperature: temperature || null,
				humidity: humidity || null,
				sensorStatus,
				timestamp: new Date(),
			});

			// Include chamber info in response
			const readingWithChamber = await O2Reading.findByPk(reading.id, {
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name'],
					},
				],
			});

			logger.info(
				`Reading added for chamber ${id}: ${calibratedO2Level}% (raw: ${o2Level})`
			);

			// Broadcast new reading via Socket.IO
			const socketHandler = getSocketHandler();
			if (socketHandler) {
				socketHandler.broadcastNewReading(id, {
					...readingWithChamber.toJSON(),
					rawO2Level: o2Level, // Include raw value for reference
				});
			}

			res.json({
				success: true,
				data: {
					...readingWithChamber.toJSON(),
					rawO2Level: o2Level,
					calibratedO2Level: calibratedO2Level,
				},
				message: 'Reading added successfully',
			});
		} catch (error) {
			logger.error('Error adding reading:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Get historical data
	async getHistoricalData(req, res) {
		try {
			const { id } = req.params;
			const {
				startDate,
				endDate,
				limit = 1000,
				interval = '1h', // 1h, 1d, 1w
			} = req.query;

			let whereClause = { chamberId: id };

			// Add date range filter if provided
			if (startDate && endDate) {
				whereClause.timestamp = {
					[require('sequelize').Op.between]: [
						new Date(startDate),
						new Date(endDate),
					],
				};
			}

			const readings = await O2Reading.findAll({
				where: whereClause,
				order: [['timestamp', 'ASC']],
				limit: parseInt(limit),
				attributes: [
					'id',
					'o2Level',
					'temperature',
					'humidity',
					'timestamp',
					'sensorStatus',
				],
			});

			// Group by interval if specified
			let groupedData = readings;
			if (interval && interval !== 'raw') {
				groupedData = this.groupReadingsByInterval(readings, interval);
			}

			res.json({
				success: true,
				data: groupedData,
				count: groupedData.length,
				interval: interval,
			});
		} catch (error) {
			logger.error('Error getting historical data:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Helper method to group readings by time interval
	groupReadingsByInterval(readings, interval) {
		const groups = {};
		const intervalMs = this.getIntervalMs(interval);

		readings.forEach((reading) => {
			const timestamp = new Date(reading.timestamp);
			const groupKey =
				Math.floor(timestamp.getTime() / intervalMs) * intervalMs;

			if (!groups[groupKey]) {
				groups[groupKey] = {
					timestamp: new Date(groupKey),
					readings: [],
					avgO2Level: 0,
					avgTemperature: 0,
					avgHumidity: 0,
					count: 0,
				};
			}

			groups[groupKey].readings.push(reading);
			groups[groupKey].count++;
		});

		// Calculate averages for each group
		Object.values(groups).forEach((group) => {
			const o2Sum = group.readings.reduce(
				(sum, r) => sum + parseFloat(r.o2Level),
				0
			);
			const tempSum = group.readings.reduce(
				(sum, r) => sum + (r.temperature || 0),
				0
			);
			const humiditySum = group.readings.reduce(
				(sum, r) => sum + (r.humidity || 0),
				0
			);

			group.avgO2Level = parseFloat((o2Sum / group.count).toFixed(2));
			group.avgTemperature = parseFloat((tempSum / group.count).toFixed(2));
			group.avgHumidity = parseFloat((humiditySum / group.count).toFixed(2));
		});

		return Object.values(groups).sort((a, b) => a.timestamp - b.timestamp);
	}

	// Helper method to get interval in milliseconds
	getIntervalMs(interval) {
		switch (interval) {
			case '1m':
				return 60 * 1000;
			case '5m':
				return 5 * 60 * 1000;
			case '15m':
				return 15 * 60 * 1000;
			case '30m':
				return 30 * 60 * 1000;
			case '1h':
				return 60 * 60 * 1000;
			case '6h':
				return 6 * 60 * 60 * 1000;
			case '12h':
				return 12 * 60 * 60 * 1000;
			case '1d':
				return 24 * 60 * 60 * 1000;
			case '1w':
				return 7 * 24 * 60 * 60 * 1000;
			default:
				return 60 * 60 * 1000; // Default to 1 hour
		}
	}
}

module.exports = new ChamberController();
