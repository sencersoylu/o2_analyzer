const { Chamber, O2Reading, Alarm, CalibrationHistory } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const logger = require('../utils/logger');

class AnalyticsController {
	// Get dashboard summary data
	async getDashboardData(req, res) {
		try {
			const { days = 7 } = req.query;
			const startDate = moment().subtract(parseInt(days), 'days').toDate();

			// Get total chambers
			const totalChambers = await Chamber.count({
				where: { isActive: true },
			});

			// Get active alarms
			const activeAlarms = await Alarm.count({
				where: { isActive: true },
			});

			// Get recent readings (last 24 hours)
			const recentReadings = await O2Reading.count({
				where: {
					timestamp: {
						[Op.gte]: moment().subtract(24, 'hours').toDate(),
					},
				},
			});

			// Get chambers requiring calibration
			const chambersNeedingCalibration = await Chamber.count({
				include: [
					{
						model: require('../models/ChamberSettings'),
						as: 'settings',
						where: { isCalibrationRequired: true },
					},
				],
			});

			// Get average O2 levels for each chamber
			const chamberAverages = await O2Reading.findAll({
				attributes: [
					'chamberId',
					[
						require('sequelize').fn('AVG', require('sequelize').col('o2Level')),
						'averageO2Level',
					],
					[
						require('sequelize').fn('COUNT', require('sequelize').col('id')),
						'readingCount',
					],
				],
				where: {
					timestamp: {
						[Op.gte]: startDate,
					},
				},
				group: ['chamberId'],
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name'],
					},
				],
			});

			// Get alarm trends
			const alarmTrends = await Alarm.findAll({
				attributes: [
					'alarmType',
					[
						require('sequelize').fn('COUNT', require('sequelize').col('id')),
						'count',
					],
				],
				where: {
					triggeredAt: {
						[Op.gte]: startDate,
					},
				},
				group: ['alarmType'],
			});

			const dashboardData = {
				summary: {
					totalChambers,
					activeAlarms,
					recentReadings,
					chambersNeedingCalibration,
				},
				chamberAverages: chamberAverages.map((item) => ({
					chamberId: item.chamberId,
					chamberName: item.chamber.name,
					averageO2Level: parseFloat(item.dataValues.averageO2Level).toFixed(2),
					readingCount: parseInt(item.dataValues.readingCount),
				})),
				alarmTrends: alarmTrends.map((item) => ({
					alarmType: item.alarmType,
					count: parseInt(item.dataValues.count),
				})),
				timeRange: {
					startDate,
					endDate: new Date(),
					days: parseInt(days),
				},
			};

			res.json({
				success: true,
				data: dashboardData,
			});
		} catch (error) {
			logger.error('Error getting dashboard data:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Get O2 level trends over time
	async getO2Trends(req, res) {
		try {
			const { chamberId, startDate, endDate, interval = 'hour' } = req.query;

			if (!startDate || !endDate) {
				return res.status(400).json({
					success: false,
					message: 'Start date and end date are required',
				});
			}

			const whereClause = {
				timestamp: {
					[Op.between]: [new Date(startDate), new Date(endDate)],
				},
			};

			if (chamberId) {
				whereClause.chamberId = parseInt(chamberId);
			}

			const readings = await O2Reading.findAll({
				where: whereClause,
				attributes: [
					'chamberId',
					'o2Level',
					'temperature',
					'humidity',
					'timestamp',
					'sensorStatus',
				],
				order: [['timestamp', 'ASC']],
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name'],
					},
				],
			});

			// Group readings by time intervals
			const groupedReadings = this.groupReadingsByInterval(readings, interval);

			res.json({
				success: true,
				data: {
					trends: groupedReadings,
					metadata: {
						startDate,
						endDate,
						interval,
						totalReadings: readings.length,
						chambers: chamberId
							? [chamberId]
							: [...new Set(readings.map((r) => r.chamberId))],
					},
				},
			});
		} catch (error) {
			logger.error('Error getting O2 trends:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Get calibration reports
	async getCalibrationReports(req, res) {
		try {
			const { startDate, endDate, chamberId } = req.query;

			const whereClause = {};

			if (startDate && endDate) {
				whereClause.calibrationDate = {
					[Op.between]: [new Date(startDate), new Date(endDate)],
				};
			}

			if (chamberId) {
				whereClause.chamberId = parseInt(chamberId);
			}

			const calibrations = await CalibrationHistory.findAll({
				where: whereClause,
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name'],
					},
				],
				order: [['calibrationDate', 'DESC']],
			});

			// Calculate statistics
			const stats = {
				totalCalibrations: calibrations.length,
				averageCalibrationLevel: 0,
				calibrationsByChamber: {},
				calibrationsByUser: {},
				recentCalibrations: calibrations.slice(0, 10),
			};

			if (calibrations.length > 0) {
				const totalLevel = calibrations.reduce(
					(sum, cal) => sum + parseFloat(cal.calibrationLevel),
					0
				);
				stats.averageCalibrationLevel = (
					totalLevel / calibrations.length
				).toFixed(2);

				// Group by chamber
				calibrations.forEach((cal) => {
					if (!stats.calibrationsByChamber[cal.chamberId]) {
						stats.calibrationsByChamber[cal.chamberId] = {
							count: 0,
							chamberName: cal.chamber.name,
							averageLevel: 0,
							totalLevel: 0,
						};
					}
					stats.calibrationsByChamber[cal.chamberId].count++;
					stats.calibrationsByChamber[cal.chamberId].totalLevel += parseFloat(
						cal.calibrationLevel
					);
				});

				// Calculate averages for each chamber
				Object.keys(stats.calibrationsByChamber).forEach((chamberId) => {
					const chamber = stats.calibrationsByChamber[chamberId];
					chamber.averageLevel = (chamber.totalLevel / chamber.count).toFixed(
						2
					);
				});

				// Group by user
				calibrations.forEach((cal) => {
					if (!stats.calibrationsByUser[cal.calibratedBy]) {
						stats.calibrationsByUser[cal.calibratedBy] = 0;
					}
					stats.calibrationsByUser[cal.calibratedBy]++;
				});
			}

			res.json({
				success: true,
				data: {
					calibrations,
					statistics: stats,
				},
			});
		} catch (error) {
			logger.error('Error getting calibration reports:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Get alarm summary reports
	async getAlarmSummaryReports(req, res) {
		try {
			const { startDate, endDate, chamberId, alarmType } = req.query;

			const whereClause = {};

			if (startDate && endDate) {
				whereClause.triggeredAt = {
					[Op.between]: [new Date(startDate), new Date(endDate)],
				};
			}

			if (chamberId) {
				whereClause.chamberId = parseInt(chamberId);
			}

			if (alarmType) {
				whereClause.alarmType = alarmType;
			}

			const alarms = await Alarm.findAll({
				where: whereClause,
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name'],
					},
				],
				order: [['triggeredAt', 'DESC']],
			});

			// Calculate statistics
			const stats = {
				totalAlarms: alarms.length,
				activeAlarms: alarms.filter((a) => a.isActive).length,
				resolvedAlarms: alarms.filter((a) => !a.isActive).length,
				alarmsByType: {},
				alarmsByChamber: {},
				averageResolutionTime: 0,
			};

			if (alarms.length > 0) {
				// Group by type
				alarms.forEach((alarm) => {
					if (!stats.alarmsByType[alarm.alarmType]) {
						stats.alarmsByType[alarm.alarmType] = {
							total: 0,
							active: 0,
							resolved: 0,
						};
					}
					stats.alarmsByType[alarm.alarmType].total++;
					if (alarm.isActive) {
						stats.alarmsByType[alarm.alarmType].active++;
					} else {
						stats.alarmsByType[alarm.alarmType].resolved++;
					}
				});

				// Group by chamber
				alarms.forEach((alarm) => {
					if (!stats.alarmsByChamber[alarm.chamberId]) {
						stats.alarmsByChamber[alarm.chamberId] = {
							total: 0,
							active: 0,
							resolved: 0,
							chamberName: alarm.chamber.name,
						};
					}
					stats.alarmsByChamber[alarm.chamberId].total++;
					if (alarm.isActive) {
						stats.alarmsByChamber[alarm.chamberId].active++;
					} else {
						stats.alarmsByChamber[alarm.chamberId].resolved++;
					}
				});

				// Calculate average resolution time
				const resolvedAlarms = alarms.filter((a) => a.resolvedAt);
				if (resolvedAlarms.length > 0) {
					const totalResolutionTime = resolvedAlarms.reduce((sum, alarm) => {
						return (
							sum +
							moment(alarm.resolvedAt).diff(
								moment(alarm.triggeredAt),
								'minutes'
							)
						);
					}, 0);
					stats.averageResolutionTime = Math.round(
						totalResolutionTime / resolvedAlarms.length
					);
				}
			}

			res.json({
				success: true,
				data: {
					alarms,
					statistics: stats,
				},
			});
		} catch (error) {
			logger.error('Error getting alarm summary reports:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Helper method to group readings by time intervals
	groupReadingsByInterval(readings, interval) {
		const grouped = {};

		readings.forEach((reading) => {
			let timeKey;

			switch (interval) {
				case 'minute':
					timeKey = moment(reading.timestamp).format('YYYY-MM-DD HH:mm');
					break;
				case 'hour':
					timeKey = moment(reading.timestamp).format('YYYY-MM-DD HH:00');
					break;
				case 'day':
					timeKey = moment(reading.timestamp).format('YYYY-MM-DD');
					break;
				default:
					timeKey = moment(reading.timestamp).format('YYYY-MM-DD HH:00');
			}

			if (!grouped[timeKey]) {
				grouped[timeKey] = {
					timestamp: timeKey,
					readings: [],
					averageO2Level: 0,
					averageTemperature: 0,
					averageHumidity: 0,
				};
			}

			grouped[timeKey].readings.push(reading);
		});

		// Calculate averages for each time group
		Object.keys(grouped).forEach((timeKey) => {
			const group = grouped[timeKey];
			const o2Levels = group.readings.map((r) => parseFloat(r.o2Level));
			const temperatures = group.readings
				.map((r) => r.temperature)
				.filter((t) => t !== null);
			const humidities = group.readings
				.map((r) => r.humidity)
				.filter((h) => h !== null);

			group.averageO2Level = (
				o2Levels.reduce((sum, val) => sum + val, 0) / o2Levels.length
			).toFixed(2);
			group.averageTemperature =
				temperatures.length > 0
					? (
							temperatures.reduce((sum, val) => sum + val, 0) /
							temperatures.length
					  ).toFixed(2)
					: null;
			group.averageHumidity =
				humidities.length > 0
					? (
							humidities.reduce((sum, val) => sum + val, 0) / humidities.length
					  ).toFixed(2)
					: null;
		});

		return Object.values(grouped).sort((a, b) =>
			moment(a.timestamp).diff(moment(b.timestamp))
		);
	}
}

module.exports = new AnalyticsController();
