const {
	ChamberSettings,
	CalibrationHistory,
	CalibrationPoints,
	Chamber,
} = require('../models');
const logger = require('../utils/logger');

class CalibrationService {
	/**
	 * 3 noktalı kalibrasyon hesaplama
	 * @param {number} zeroPointRaw - 0% için okunan ham değer
	 * @param {number} midPointRaw - Orta nokta için okunan ham değer
	 * @param {number} hundredPointRaw - 100% için okunan ham değer
	 * @param {number} midPointCalibrated - Orta nokta için kalibre edilmiş değer (genellikle 21%)
	 * @returns {object} Kalibrasyon katsayıları
	 */
	calculateCalibrationCoefficients(
		zeroPointRaw,
		midPointRaw,
		hundredPointRaw,
		midPointCalibrated = 21.0
	) {
		try {
			// 3 noktalı kalibrasyon hesaplama
			// 0% noktası: (0, 0)
			// Orta nokta: (midPointRaw, midPointCalibrated)
			// 100% noktası: (hundredPointRaw, 100)

			// İki doğru parçası için eğim hesaplama
			// 1. Doğru: 0% -> Orta nokta
			const slope1 = (midPointCalibrated - 0) / (midPointRaw - zeroPointRaw);

			// 2. Doğru: Orta nokta -> 100%
			const slope2 =
				(100 - midPointCalibrated) / (hundredPointRaw - midPointRaw);

			// Ortalama eğim (basit yaklaşım)
			const avgSlope = (slope1 + slope2) / 2;

			// Offset hesaplama (0% noktasından)
			const offset = 0 - avgSlope * zeroPointRaw;

			return {
				slope: parseFloat(avgSlope.toFixed(6)),
				offset: parseFloat(offset.toFixed(6)),
				zeroPoint: { raw: zeroPointRaw, calibrated: 0 },
				midPoint: { raw: midPointRaw, calibrated: midPointCalibrated },
				hundredPoint: { raw: hundredPointRaw, calibrated: 100 },
			};
		} catch (error) {
			logger.error('Error calculating calibration coefficients:', error);
			throw new Error('Calibration calculation failed');
		}
	}

	/**
	 * Ham sensör değerini kalibre edilmiş değere dönüştür
	 * @param {number} rawValue - Ham sensör değeri
	 * @param {number} slope - Kalibrasyon eğimi
	 * @param {number} offset - Kalibrasyon offset değeri
	 * @returns {number} Kalibre edilmiş değer
	 */
	applyCalibration(rawValue, slope, offset) {
		const calibratedValue = rawValue * slope + offset;
		return Math.max(0, Math.min(100, calibratedValue)); // 0-100 arasında sınırla
	}

	/**
	 * 3 noktalı kalibrasyon gerçekleştir
	 * @param {number} chamberId - Oda ID
	 * @param {object} calibrationData - Kalibrasyon verileri
	 * @param {string} calibratedBy - Kalibrasyonu yapan kişi
	 * @param {string} notes - Notlar
	 * @returns {object} Kalibrasyon sonucu
	 */
	async performThreePointCalibration(
		chamberId,
		calibrationData,
		calibratedBy = 'system',
		notes = ''
	) {
		try {
			const {
				zeroPointRaw,
				midPointRaw,
				hundredPointRaw,
				midPointCalibrated = 21.0,
			} = calibrationData;

			// Validasyon
			if (!zeroPointRaw || !midPointRaw || !hundredPointRaw) {
				throw new Error('All calibration points are required');
			}

			if (zeroPointRaw >= midPointRaw || midPointRaw >= hundredPointRaw) {
				throw new Error('Calibration points must be in ascending order');
			}

			// Kalibrasyon katsayılarını hesapla
			const coefficients = this.calculateCalibrationCoefficients(
				zeroPointRaw,
				midPointRaw,
				hundredPointRaw,
				midPointCalibrated
			);

			// Önceki aktif kalibrasyonu deaktif et
			await CalibrationPoints.update(
				{ isActive: false },
				{ where: { chamberId, isActive: true } }
			);

			// Yeni kalibrasyon noktalarını kaydet
			const calibrationPoints = await CalibrationPoints.create({
				chamberId,
				zeroPointRaw,
				zeroPointCalibrated: 0,
				midPointRaw,
				midPointCalibrated,
				hundredPointRaw,
				hundredPointCalibrated: 100,
				calibrationSlope: coefficients.slope,
				calibrationOffset: coefficients.offset,
				calibratedBy,
				notes,
			});

			// Kalibrasyon geçmişine kaydet
			await CalibrationHistory.create({
				chamberId,
				calibrationLevel: midPointCalibrated,
				calibratedBy,
				notes: `3-point calibration: 0%(${zeroPointRaw}) -> ${midPointCalibrated}%(${midPointRaw}) -> 100%(${hundredPointRaw})`,
			});

			// Chamber settings'i güncelle
			const settings = await ChamberSettings.findOne({ where: { chamberId } });
			if (settings) {
				await settings.update({
					isCalibrationRequired: false,
					lastCalibration: new Date(),
				});
			}

			logger.info(`3-point calibration completed for chamber ${chamberId}`);

			return {
				calibrationPoints,
				coefficients,
				message: '3-point calibration completed successfully',
			};
		} catch (error) {
			logger.error('Error performing 3-point calibration:', error);
			throw error;
		}
	}

	/**
	 * Aktif kalibrasyon noktalarını getir
	 * @param {number} chamberId - Oda ID
	 * @returns {object} Aktif kalibrasyon noktaları
	 */
	async getActiveCalibrationPoints(chamberId) {
		try {
			const calibrationPoints = await CalibrationPoints.findOne({
				where: { chamberId, isActive: true },
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name'],
					},
				],
			});

			return calibrationPoints;
		} catch (error) {
			logger.error('Error getting active calibration points:', error);
			throw error;
		}
	}

	/**
	 * Ham sensör değerini kalibre et
	 * @param {number} chamberId - Oda ID
	 * @param {number} rawValue - Ham sensör değeri
	 * @returns {number} Kalibre edilmiş değer
	 */
	async calibrateReading(chamberId, rawValue) {
		try {
			const calibrationPoints = await this.getActiveCalibrationPoints(
				chamberId
			);

			if (!calibrationPoints) {
				logger.warn(
					`No active calibration found for chamber ${chamberId}, using raw value`
				);
				return rawValue;
			}

			const calibratedValue = this.applyCalibration(
				rawValue,
				calibrationPoints.calibrationSlope,
				calibrationPoints.calibrationOffset
			);

			return parseFloat(calibratedValue.toFixed(2));
		} catch (error) {
			logger.error('Error calibrating reading:', error);
			return rawValue; // Hata durumunda ham değeri döndür
		}
	}

	/**
	 * Kalibrasyon geçmişini getir
	 * @param {number} chamberId - Oda ID
	 * @param {number} limit - Limit
	 * @returns {array} Kalibrasyon geçmişi
	 */
	async getCalibrationHistory(chamberId, limit = 50) {
		try {
			const history = await CalibrationPoints.findAll({
				where: { chamberId },
				order: [['calibrationDate', 'DESC']],
				limit: parseInt(limit),
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name'],
					},
				],
			});

			return history;
		} catch (error) {
			logger.error('Error getting calibration history:', error);
			throw error;
		}
	}

	/**
	 * Kalibrasyon durumunu kontrol et
	 * @param {number} chamberId - Oda ID
	 * @returns {object} Kalibrasyon durumu
	 */
	async checkCalibrationStatus(chamberId) {
		try {
			const calibrationPoints = await this.getActiveCalibrationPoints(
				chamberId
			);
			const settings = await ChamberSettings.findOne({ where: { chamberId } });

			return {
				hasActiveCalibration: !!calibrationPoints,
				lastCalibration: calibrationPoints?.calibrationDate || null,
				isCalibrationRequired: settings?.isCalibrationRequired || false,
				calibrationPoints: calibrationPoints
					? {
							zeroPoint: {
								raw: calibrationPoints.zeroPointRaw,
								calibrated: calibrationPoints.zeroPointCalibrated,
							},
							midPoint: {
								raw: calibrationPoints.midPointRaw,
								calibrated: calibrationPoints.midPointCalibrated,
							},
							hundredPoint: {
								raw: calibrationPoints.hundredPointRaw,
								calibrated: calibrationPoints.hundredPointCalibrated,
							},
							coefficients: {
								slope: calibrationPoints.calibrationSlope,
								offset: calibrationPoints.calibrationOffset,
							},
					  }
					: null,
			};
		} catch (error) {
			logger.error('Error checking calibration status:', error);
			throw error;
		}
	}

	// Eski metodları uyumluluk için koruyoruz
	async performCalibration(
		chamberId,
		calibrationLevel,
		calibratedBy = 'system',
		notes = ''
	) {
		// Eski tek noktalı kalibrasyon yerine 3 noktalı kalibrasyon önerisi
		throw new Error(
			'Please use performThreePointCalibration for 3-point calibration'
		);
	}

	async recordSensorChange(chamberId, sensorModel, sensorSerialNumber) {
		try {
			const settings = await ChamberSettings.findOne({ where: { chamberId } });

			if (!settings) {
				throw new Error('Chamber settings not found');
			}

			await settings.update({
				sensorModel,
				sensorSerialNumber,
				isCalibrationRequired: true,
				lastCalibration: null,
			});

			logger.info(`Sensor change recorded for chamber ${chamberId}`);

			return settings;
		} catch (error) {
			logger.error('Error recording sensor change:', error);
			throw error;
		}
	}

	async markCalibrationRequired(chamberId, reason = '') {
		try {
			const settings = await ChamberSettings.findOne({ where: { chamberId } });

			if (!settings) {
				throw new Error('Chamber settings not found');
			}

			await settings.update({
				isCalibrationRequired: true,
			});

			logger.info(
				`Calibration marked as required for chamber ${chamberId}: ${reason}`
			);

			return settings;
		} catch (error) {
			logger.error('Error marking calibration required:', error);
			throw error;
		}
	}

	async getCalibrationStats(chamberId = null, days = 30) {
		try {
			const whereClause = {};
			if (chamberId) {
				whereClause.chamberId = chamberId;
			}

			const startDate = new Date();
			startDate.setDate(startDate.getDate() - days);

			const stats = await CalibrationPoints.findAll({
				where: {
					...whereClause,
					calibrationDate: {
						[require('sequelize').Op.gte]: startDate,
					},
				},
				attributes: [
					'chamberId',
					[
						require('sequelize').fn('COUNT', require('sequelize').col('id')),
						'totalCalibrations',
					],
					[
						require('sequelize').fn(
							'MAX',
							require('sequelize').col('calibrationDate')
						),
						'lastCalibration',
					],
				],
				group: ['chamberId'],
				include: [
					{
						model: Chamber,
						as: 'chamber',
						attributes: ['id', 'name'],
					},
				],
			});

			return stats;
		} catch (error) {
			logger.error('Error getting calibration stats:', error);
			throw error;
		}
	}
}

module.exports = new CalibrationService();
