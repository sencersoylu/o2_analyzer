const alarmService = require('../services/alarmService');
const logger = require('../utils/logger');

class AlarmController {
	// Get all active alarms
	async getActiveAlarms(req, res) {
		try {
			const alarms = await alarmService.getActiveAlarms();

			res.json({
				success: true,
				data: alarms,
				count: alarms.length,
			});
		} catch (error) {
			logger.error('Error getting active alarms:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Get chamber-specific alarms
	async getChamberAlarms(req, res) {
		try {
			const { id } = req.params;
			const { includeResolved = false } = req.query;

			const alarms = await alarmService.getChamberAlarms(
				id,
				includeResolved === 'true'
			);

			res.json({
				success: true,
				data: alarms,
				count: alarms.length,
			});
		} catch (error) {
			logger.error('Error getting chamber alarms:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Mute alarm
	async muteAlarm(req, res) {
		try {
			const { id } = req.params;
			const { mutedUntil } = req.body;

			const alarm = await alarmService.muteAlarm(
				id,
				mutedUntil ? new Date(mutedUntil) : null
			);

			res.json({
				success: true,
				data: alarm,
				message: 'Alarm muted successfully',
			});
		} catch (error) {
			logger.error('Error muting alarm:', error);

			if (error.message === 'Alarm not found') {
				return res.status(404).json({
					success: false,
					message: 'Alarm not found',
				});
			}

			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Resolve alarm
	async resolveAlarm(req, res) {
		try {
			const { id } = req.params;

			const alarm = await alarmService.resolveAlarm(id);

			res.json({
				success: true,
				data: alarm,
				message: 'Alarm resolved successfully',
			});
		} catch (error) {
			logger.error('Error resolving alarm:', error);

			if (error.message === 'Alarm not found') {
				return res.status(404).json({
					success: false,
					message: 'Alarm not found',
				});
			}

			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Get alarm history
	async getAlarmHistory(req, res) {
		try {
			const {
				chamberId,
				alarmType,
				startDate,
				endDate,
				page = 1,
				limit = 50,
			} = req.query;

			const filters = {
				chamberId: chamberId ? parseInt(chamberId) : null,
				alarmType,
				startDate: startDate ? new Date(startDate) : null,
				endDate: endDate ? new Date(endDate) : null,
				limit: parseInt(limit),
				offset: (parseInt(page) - 1) * parseInt(limit),
			};

			const alarms = await alarmService.getAlarmHistory(filters);

			res.json({
				success: true,
				data: alarms,
				pagination: {
					page: parseInt(page),
					limit: parseInt(limit),
				},
			});
		} catch (error) {
			logger.error('Error getting alarm history:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}

	// Get alarm statistics
	async getAlarmStats(req, res) {
		try {
			const { startDate, endDate } = req.query;

			// This would typically come from a more sophisticated analytics service
			// For now, we'll provide basic stats
			const activeAlarms = await alarmService.getActiveAlarms();

			const stats = {
				totalActiveAlarms: activeAlarms.length,
				alarmsByType: {},
				alarmsByChamber: {},
				recentAlarms: activeAlarms.slice(0, 10), // Last 10 alarms
			};

			// Group alarms by type
			activeAlarms.forEach((alarm) => {
				if (!stats.alarmsByType[alarm.alarmType]) {
					stats.alarmsByType[alarm.alarmType] = 0;
				}
				stats.alarmsByType[alarm.alarmType]++;
			});

			// Group alarms by chamber
			activeAlarms.forEach((alarm) => {
				if (!stats.alarmsByChamber[alarm.chamberId]) {
					stats.alarmsByChamber[alarm.chamberId] = 0;
				}
				stats.alarmsByChamber[alarm.chamberId]++;
			});

			res.json({
				success: true,
				data: stats,
			});
		} catch (error) {
			logger.error('Error getting alarm stats:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
			});
		}
	}
}

module.exports = new AlarmController();
