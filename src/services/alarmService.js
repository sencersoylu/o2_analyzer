const { Alarm, Chamber, ChamberSettings } = require('../models');
const logger = require('../utils/logger');
const moment = require('moment');

// Get socket handler for real-time notifications
const getSocketHandler = () => {
	return global.socketHandler;
};

// Get PLC alarm register based on chamber ID
const getAlarmRegister = (chamberId) => {
	// Ana Kabin (main): M00407, Ara Kabin (intermediate): M00408
	if (chamberId === 1) return 'M00407';
	if (chamberId === 2) return 'M00408';
	return null;
};

// Send writeBit command to PLC for alarm state
const sendAlarmToPLC = (chamberId, value) => {
	const socketHandler = getSocketHandler();
	const register = getAlarmRegister(chamberId);
	
	if (socketHandler && register) {
		socketHandler.io.emit('writeBit', { register, value });
		logger.info(`PLC writeBit sent: register=${register}, value=${value}`);
	}
};

class AlarmService {
	// Check for new alarms based on O2 reading
	async checkForAlarms(chamberId, o2Level, sensorStatus) {
		try {
			const settings = await ChamberSettings.findOne({
				where: { chamberId },
			});

			if (!settings) {
				logger.warn(`No settings found for chamber ${chamberId}`);
				return;
			}

			const alarms = [];

			// Check for high O2 alarm
			if (o2Level > settings.alarmLevelHigh) {
				const existingAlarm = await Alarm.findOne({
					where: {
						chamberId,
						alarmType: 'high_o2',
						isActive: true,
					},
				});

				if (!existingAlarm) {
					const alarm = await Alarm.create({
						chamberId,
						alarmType: 'high_o2',
						o2LevelWhenTriggered: o2Level,
						triggeredAt: new Date(),
					});
					alarms.push(alarm);
					logger.info(
						`High O2 alarm triggered for chamber ${chamberId}: ${o2Level}%`
					);

					// Broadcast alarm via Socket.IO
					const socketHandler = getSocketHandler();
					if (socketHandler) {
						socketHandler.broadcastAlarm(alarm);
					}
					
					// Send alarm signal to PLC
					sendAlarmToPLC(chamberId, 1);
				}
			}

			// Check for low O2 alarm
			if (o2Level < settings.alarmLevelLow) {
				const existingAlarm = await Alarm.findOne({
					where: {
						chamberId,
						alarmType: 'low_o2',
						isActive: true,
					},
				});

				if (!existingAlarm) {
					const alarm = await Alarm.create({
						chamberId,
						alarmType: 'low_o2',
						o2LevelWhenTriggered: o2Level,
						triggeredAt: new Date(),
					});
					alarms.push(alarm);
					logger.info(
						`Low O2 alarm triggered for chamber ${chamberId}: ${o2Level}%`
					);

					// Broadcast alarm via Socket.IO
					const socketHandler = getSocketHandler();
					if (socketHandler) {
						socketHandler.broadcastAlarm(alarm);
					}
					
					// Send alarm signal to PLC
					sendAlarmToPLC(chamberId, 1);
				}
			}

			// Check for sensor error alarm
			if (sensorStatus === 'error') {
				const existingAlarm = await Alarm.findOne({
					where: {
						chamberId,
						alarmType: 'sensor_error',
						isActive: true,
					},
				});

				if (!existingAlarm) {
					const alarm = await Alarm.create({
						chamberId,
						alarmType: 'sensor_error',
						triggeredAt: new Date(),
					});
					alarms.push(alarm);
					logger.warn(`Sensor error alarm triggered for chamber ${chamberId}`);

					// Broadcast alarm via Socket.IO
					const socketHandler = getSocketHandler();
					if (socketHandler) {
						socketHandler.broadcastAlarm(alarm);
					}
				}
			}

			// Check for calibration due alarm
			if (settings.isCalibrationRequired) {
				const existingAlarm = await Alarm.findOne({
					where: {
						chamberId,
						alarmType: 'calibration_due',
						isActive: true,
					},
				});

				if (!existingAlarm) {
					const alarm = await Alarm.create({
						chamberId,
						alarmType: 'calibration_due',
						triggeredAt: new Date(),
					});
					alarms.push(alarm);
					logger.info(
						`Calibration due alarm triggered for chamber ${chamberId}`
					);

					// Broadcast alarm via Socket.IO
					const socketHandler = getSocketHandler();
					if (socketHandler) {
						socketHandler.broadcastAlarm(alarm);
					}
				}
			}

			return alarms;
		} catch (error) {
			logger.error('Error checking for alarms:', error);
			throw error;
		}
	}

	// Resolve alarms when conditions return to normal
	async resolveAlarms(chamberId, o2Level, sensorStatus) {
		try {
			const settings = await ChamberSettings.findOne({
				where: { chamberId },
			});

			if (!settings) return;

			const resolvedAlarms = [];

			// Resolve high O2 alarm
			if (o2Level <= settings.alarmLevelHigh) {
				const alarm = await Alarm.findOne({
					where: {
						chamberId,
						alarmType: 'high_o2',
						isActive: true,
					},
				});

				if (alarm) {
					await alarm.update({
						isActive: false,
						resolvedAt: new Date(),
					});
					resolvedAlarms.push(alarm);
					logger.info(`High O2 alarm resolved for chamber ${chamberId}`);

					// Broadcast alarm resolution via Socket.IO
					const socketHandler = getSocketHandler();
					if (socketHandler) {
						socketHandler.broadcastAlarmResolved(alarm);
					}
					
					// Send resolve signal to PLC (value: 0)
					sendAlarmToPLC(chamberId, 0);
				}
			}

			// Resolve low O2 alarm
			if (o2Level >= settings.alarmLevelLow) {
				const alarm = await Alarm.findOne({
					where: {
						chamberId,
						alarmType: 'low_o2',
						isActive: true,
					},
				});

				if (alarm) {
					await alarm.update({
						isActive: false,
						resolvedAt: new Date(),
					});
					resolvedAlarms.push(alarm);
					logger.info(`Low O2 alarm resolved for chamber ${chamberId}`);

					// Broadcast alarm resolution via Socket.IO
					const socketHandler = getSocketHandler();
					if (socketHandler) {
						socketHandler.broadcastAlarmResolved(alarm);
					}
					
					// Send resolve signal to PLC (value: 0)
					sendAlarmToPLC(chamberId, 0);
				}
			}

			// Resolve sensor error alarm
			if (sensorStatus !== 'error') {
				const alarm = await Alarm.findOne({
					where: {
						chamberId,
						alarmType: 'sensor_error',
						isActive: true,
					},
				});

				if (alarm) {
					await alarm.update({
						isActive: false,
						resolvedAt: new Date(),
					});
					resolvedAlarms.push(alarm);
					logger.info(`Sensor error alarm resolved for chamber ${chamberId}`);

					// Broadcast alarm resolution via Socket.IO
					const socketHandler = getSocketHandler();
					if (socketHandler) {
						socketHandler.broadcastAlarmResolved(alarm);
					}
				}
			}

			// Resolve calibration due alarm
			if (!settings.isCalibrationRequired) {
				const alarm = await Alarm.findOne({
					where: {
						chamberId,
						alarmType: 'calibration_due',
						isActive: true,
					},
				});

				if (alarm) {
					await alarm.update({
						isActive: false,
						resolvedAt: new Date(),
					});
					resolvedAlarms.push(alarm);
					logger.info(
						`Calibration due alarm resolved for chamber ${chamberId}`
					);

					// Broadcast alarm resolution via Socket.IO
					const socketHandler = getSocketHandler();
					if (socketHandler) {
						socketHandler.broadcastAlarmResolved(alarm);
					}
				}
			}

			return resolvedAlarms;
		} catch (error) {
			logger.error('Error resolving alarms:', error);
			throw error;
		}
	}

	// Get all active alarms
	async getActiveAlarms() {
		try {
			return await Alarm.findAll({
				where: { isActive: true },
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name', 'description'],
					},
				],
				order: [['triggeredAt', 'DESC']],
			});
		} catch (error) {
			logger.error('Error getting active alarms:', error);
			throw error;
		}
	}

	// Get alarms for specific chamber
	async getChamberAlarms(chamberId, includeResolved = false) {
		try {
			const whereClause = { chamberId };
			if (!includeResolved) {
				whereClause.isActive = true;
			}

			return await Alarm.findAll({
				where: whereClause,
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name', 'description'],
					},
				],
				order: [['triggeredAt', 'DESC']],
			});
		} catch (error) {
			logger.error('Error getting chamber alarms:', error);
			throw error;
		}
	}

	// Mute alarm
	async muteAlarm(alarmId, mutedUntil) {
		try {
			const alarm = await Alarm.findByPk(alarmId);
			if (!alarm) {
				throw new Error('Alarm not found');
			}

			await alarm.update({
				isMuted: true,
				mutedUntil: mutedUntil || moment().add(1, 'hour').toDate(),
			});

			// Send mute signal to PLC (value: 0)
			sendAlarmToPLC(alarm.chamberId, 0);

			logger.info(`Alarm ${alarmId} muted until ${mutedUntil}`);
			return alarm;
		} catch (error) {
			logger.error('Error muting alarm:', error);
			throw error;
		}
	}

	// Resolve alarm manually
	async resolveAlarm(alarmId) {
		try {
			const alarm = await Alarm.findByPk(alarmId);
			if (!alarm) {
				throw new Error('Alarm not found');
			}

			await alarm.update({
				isActive: false,
				resolvedAt: new Date(),
			});

			// Send resolve signal to PLC (value: 0)
			sendAlarmToPLC(alarm.chamberId, 0);

			logger.info(`Alarm ${alarmId} manually resolved`);
			return alarm;
		} catch (error) {
			logger.error('Error resolving alarm:', error);
			throw error;
		}
	}

	// Get alarm history with filters
	async getAlarmHistory(filters = {}) {
		try {
			const whereClause = {};

			if (filters.chamberId) {
				whereClause.chamberId = filters.chamberId;
			}

			if (filters.alarmType) {
				whereClause.alarmType = filters.alarmType;
			}

			if (filters.startDate && filters.endDate) {
				whereClause.triggeredAt = {
					[require('sequelize').Op.between]: [
						filters.startDate,
						filters.endDate,
					],
				};
			}

			return await Alarm.findAll({
				where: whereClause,
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name', 'description'],
					},
				],
				order: [['triggeredAt', 'DESC']],
				limit: filters.limit || 100,
				offset: filters.offset || 0,
			});
		} catch (error) {
			logger.error('Error getting alarm history:', error);
			throw error;
		}
	}
}

module.exports = new AlarmService();
