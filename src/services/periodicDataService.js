const { Chamber, O2Reading } = require('../models');
const calibrationService = require('./calibrationService');
const logger = require('../utils/logger');

class PeriodicDataService {
	/**
	 * Tüm chamber'ların kalibre edilmiş verilerini ve ayarlarını topla
	 * @returns {Array} Chamber veriler listesi
	 */
	async getCalibratedChamberData() {
		try {
			// Tüm aktif chamber'ları getir
			const chambers = await Chamber.findAll({
				where: {
					isActive: true,
				},
				order: [['id', 'ASC']],
			});

			// Her chamber için veri topla
			const chamberDataPromises = chambers.map(async (chamber) => {
				try {
					// En son O2 okumasını getir
					const latestReading = await O2Reading.findOne({
						where: { chamberId: chamber.id },
						order: [['timestamp', 'DESC']],
					});

					// Kalibrasyon durumunu kontrol et
					const calibrationStatus =
						await calibrationService.checkCalibrationStatus(chamber.id);

					// Ham değeri kalibre et (eğer lastRawFromPLC varsa)
					let calibratedCurrentValue = null;
					if (chamber.lastRawFromPLC !== null) {
						// Raw PLC değerini O2 yüzdesine çevir (basit linear conversion)
						const minRaw = 2500;
						const maxRaw = 16383;
						const minO2 = 0;
						const maxO2 = 100;

						let convertedO2 =
							((chamber.lastRawFromPLC - minRaw) / (maxRaw - minRaw)) *
								(maxO2 - minO2) +
							minO2;
						convertedO2 = Math.max(minO2, Math.min(maxO2, convertedO2));

						// Kalibre et
						calibratedCurrentValue = await calibrationService.calibrateReading(
							chamber.id,
							convertedO2
						);
					}

					return {
						id: chamber.id,
						name: chamber.name,
						description: chamber.description,
						isActive: chamber.isActive,
						// Güncel kalibre edilmiş değer
						currentCalibratedValue: calibratedCurrentValue,
						lastRawFromPLC: chamber.lastRawFromPLC,
						lastValue: chamber.lastValue,
						// En son veritabanı okuması
						latestReading: latestReading
							? {
									id: latestReading.id,
									o2Level: latestReading.o2Level,
									temperature: latestReading.temperature,
									humidity: latestReading.humidity,
									sensorStatus: latestReading.sensorStatus,
									timestamp: latestReading.timestamp,
							  }
							: null,
						// Alarm ayarları
						alarmSettings: {
							alarmLevelHigh: chamber.alarmLevelHigh,
							alarmLevelLow: chamber.alarmLevelLow,
						},
						// Kalibrasyon bilgileri
						calibrationInfo: {
							hasActiveCalibration: calibrationStatus.hasActiveCalibration,
							lastCalibration: calibrationStatus.lastCalibration,
							calibrationPoints: calibrationStatus.calibrationPoints,
							isCalibrationRequired: calibrationStatus.isCalibrationRequired,
						},
						// Diğer ayarlar
						lastSensorChange: chamber.lastSensorChange,
						calibrationDate: chamber.calibrationDate,
						raw0: chamber.raw0,
						raw21: chamber.raw21,
						raw100: chamber.raw100,
						updatedAt: chamber.updatedAt,
					};
				} catch (error) {
					logger.error(
						`Error collecting data for chamber ${chamber.id}:`,
						error
					);
					// Hata durumunda temel bilgileri döndür
					return {
						id: chamber.id,
						name: chamber.name,
						description: chamber.description,
						isActive: chamber.isActive,
						error: 'Data collection failed',
						currentCalibratedValue: null,
						latestReading: null,
						alarmSettings: {
							alarmLevelHigh: chamber.alarmLevelHigh,
							alarmLevelLow: chamber.alarmLevelLow,
						},
						calibrationInfo: {
							hasActiveCalibration: false,
							lastCalibration: null,
							calibrationPoints: null,
							isCalibrationRequired: false,
						},
					};
				}
			});

			// Tüm promise'ları bekle
			const chamberData = await Promise.all(chamberDataPromises);

			logger.debug(
				`Collected calibrated data for ${chamberData.length} chambers`
			);
			return chamberData;
		} catch (error) {
			logger.error('Error in getCalibratedChamberData:', error);
			return [];
		}
	}

	/**
	 * Belirli bir chamber için kalibre edilmiş veriyi getir
	 * @param {number} chamberId - Chamber ID
	 * @returns {Object|null} Chamber verisi
	 */
	async getCalibratedChamberDataById(chamberId) {
		try {
			const allData = await this.getCalibratedChamberData();
			return (
				allData.find((chamber) => chamber.id === parseInt(chamberId)) || null
			);
		} catch (error) {
			logger.error(
				`Error getting calibrated data for chamber ${chamberId}:`,
				error
			);
			return null;
		}
	}
	constructor() {
		this.broadcastIntervalId = null;
		this.broadcastIntervalMs = 500;
	}

	/**
	 * Start periodic chamber data broadcast
	 * @param {Object} socketHandler - SocketHandler instance
	 */
	startBroadcast(socketHandler) {
		if (this.broadcastIntervalId) {
			logger.warn('Periodic data broadcast is already running');
			return;
		}

		if (!socketHandler) {
			logger.error('SocketHandler not provided for periodic broadcast');
			return;
		}

		this.broadcastIntervalId = setInterval(async () => {
			try {
				// Get calibrated chamber data
				const chamberData = await this.getCalibratedChamberData();

				// Broadcast via Socket.IO
				if (chamberData.length > 0) {
					socketHandler.broadcastPeriodicChamberData(chamberData);
				}
			} catch (error) {
				logger.error('Error in periodic data broadcast:', error);
			}
		}, this.broadcastIntervalMs);

		logger.info(
			`Periodic chamber data broadcast started (${this.broadcastIntervalMs}ms interval)`
		);
	}

	/**
	 * Stop periodic chamber data broadcast
	 */
	stopBroadcast() {
		if (this.broadcastIntervalId) {
			clearInterval(this.broadcastIntervalId);
			this.broadcastIntervalId = null;
			logger.info('Periodic chamber data broadcast stopped');
		}
	}
}

module.exports = new PeriodicDataService();
