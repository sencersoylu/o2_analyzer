const plcService = require('./plcService');
const { Chamber } = require('../models');
const logger = require('../utils/logger');

class PeriodicPLCReader {
	constructor() {
		this.intervalId = null;
		this.isRunning = false;
		this.interval = 500; // 500ms interval as requested
		this.lastReadAttempt = null;
		this.successfulReads = 0;
		this.failedReads = 0;
		this.chamberSensorMapping = {
			1: 0, // Chamber 1 (Main) uses sensor index 0
			2: 1, // Chamber 2 (Entry) uses sensor index 4
		};
	}

	/**
	 * Start the periodic PLC reading
	 */
	start() {
		if (this.isRunning) {
			logger.warn('Periodic PLC reader is already running');
			return;
		}

		logger.info(
			`Starting periodic PLC reader with ${this.interval}ms interval`
		);
		this.isRunning = true;

		// Start the interval
		this.intervalId = setInterval(() => {
			this.readAndUpdateChambers();
		}, this.interval);

		// Also run immediately
		this.readAndUpdateChambers();
	}

	/**
	 * Stop the periodic PLC reading
	 */
	stop() {
		if (!this.isRunning) {
			logger.warn('Periodic PLC reader is not running');
			return;
		}

		logger.info('Stopping periodic PLC reader');
		this.isRunning = false;

		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/**
	 * Read raw values from PLC and update chamber lastRawFromPLC fields
	 */
	async readAndUpdateChambers() {
		try {
			this.lastReadAttempt = new Date();

			// Read raw values from PLC
			const plcResult = await plcService.readRawValues(2); // Read 19 sensor values

			if (!plcResult.success) {
				this.failedReads++;
				logger.debug(`Failed to read from PLC: ${plcResult.error}`);
				return;
			}

			this.successfulReads++;
			const rawData = plcResult.data;

			// Get all active chambers
			const chambers = await Chamber.findAll({
				where: {
					isActive: true,
				},
			});

			// Update each chamber with its corresponding raw value
			const updatePromises = chambers.map(async (chamber) => {
				try {
					const sensorIndex = this.chamberSensorMapping[chamber.id];

					if (sensorIndex !== undefined && rawData[sensorIndex] !== undefined) {
						const rawValue = rawData[sensorIndex];

						// Update the chamber's lastRawFromPLC field
						await chamber.update({
							lastRawFromPLC: rawValue,
						});

						logger.debug(
							`Updated chamber ${chamber.id} (${chamber.name}) lastRawFromPLC: ${rawValue}`
						);

						// Broadcast the update via Socket.IO if available
						const socketHandler = global.socketHandler;
						if (socketHandler) {
							socketHandler.broadcastChamberRawValue(chamber.id, {
								chamberId: chamber.id,
								chamberName: chamber.name,
								lastRawFromPLC: rawValue,
								sensorIndex: sensorIndex,
								timestamp: new Date().toISOString(),
							});
						}
					} else {
						logger.debug(
							`No sensor mapping found for chamber ${chamber.id} or sensor data unavailable`
						);
					}
				} catch (error) {
					logger.error(`Error updating chamber ${chamber.id}:`, error);
				}
			});

			// Wait for all chamber updates to complete
			await Promise.all(updatePromises);

			// Log periodic status (every 100 successful reads to avoid spam)
			if (this.successfulReads % 100 === 0) {
				logger.info(
					`Periodic PLC reader stats - Success: ${this.successfulReads}, Failed: ${this.failedReads}`
				);
			}
		} catch (error) {
			this.failedReads++;
			logger.error('Error in periodic PLC reader:', error);
		}
	}

	/**
	 * Get statistics about the periodic reader
	 */
	getStats() {
		return {
			isRunning: this.isRunning,
			interval: this.interval,
			lastReadAttempt: this.lastReadAttempt,
			successfulReads: this.successfulReads,
			failedReads: this.failedReads,
			successRate:
				this.successfulReads + this.failedReads > 0
					? (
							(this.successfulReads /
								(this.successfulReads + this.failedReads)) *
							100
					  ).toFixed(2) + '%'
					: '0%',
			chamberSensorMapping: this.chamberSensorMapping,
		};
	}

	/**
	 * Update the sensor mapping for chambers
	 */
	updateSensorMapping(mapping) {
		logger.info('Updating chamber sensor mapping:', mapping);
		this.chamberSensorMapping = { ...this.chamberSensorMapping, ...mapping };
	}

	/**
	 * Update the reading interval
	 */
	updateInterval(newInterval) {
		if (newInterval < 100) {
			throw new Error('Interval cannot be less than 100ms for safety');
		}

		logger.info(
			`Updating periodic PLC reader interval from ${this.interval}ms to ${newInterval}ms`
		);
		this.interval = newInterval;

		// Restart with new interval if currently running
		if (this.isRunning) {
			this.stop();
			this.start();
		}
	}
}

module.exports = new PeriodicPLCReader();
