const plcService = require('../services/plcService');
const periodicPLCReader = require('../services/periodicPlcReader');
const logger = require('../utils/logger');

// Get socket handler for real-time notifications
const getSocketHandler = () => {
	return global.socketHandler;
};

class PLCController {
	/**
	 * Read all raw values from PLC register R02000
	 */
	readRawValues = async (req, res) => {
		try {
			const { numValues } = req.query;
			const count = numValues ? parseInt(numValues) : 19;

			if (count < 1 || count > 50) {
				return res.status(400).json({
					success: false,
					message: 'numValues must be between 1 and 50',
				});
			}

			const result = await plcService.readRawValues(count);

			if (!result.success) {
				return res.status(500).json({
					success: false,
					message: 'Failed to read from PLC',
					error: result.error,
					connectionStatus: plcService.getConnectionStatus(),
				});
			}

			// Broadcast via Socket.IO if available
			const socketHandler = getSocketHandler();
			if (socketHandler) {
				socketHandler.broadcastPLCData(result);
			}

			res.json({
				success: true,
				data: result.data,
				metadata: {
					isConnectedPLC: result.isConnectedPLC,
					timestamp: result.timestamp,
					count: result.data.length,
				},
			});
		} catch (error) {
			logger.error('Error in readRawValues controller:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
				error: error.message,
			});
		}
	};

	/**
	 * Read a specific sensor value by index
	 */
	readSensorValue = async (req, res) => {
		try {
			const { sensorIndex } = req.params;
			const index = parseInt(sensorIndex);

			if (isNaN(index) || index < 0) {
				return res.status(400).json({
					success: false,
					message: 'sensorIndex must be a non-negative integer',
				});
			}

			const result = await plcService.readSensorValue(index);

			if (!result.success) {
				return res.status(500).json({
					success: false,
					message: 'Failed to read sensor value',
					error: result.error,
					connectionStatus: plcService.getConnectionStatus(),
				});
			}

			res.json({
				success: true,
				data: {
					sensorIndex: result.sensorIndex,
					value: result.value,
					timestamp: result.timestamp,
				},
				metadata: {
					isConnectedPLC: result.isConnectedPLC,
					allValues: result.allValues,
				},
			});
		} catch (error) {
			logger.error('Error in readSensorValue controller:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
				error: error.message,
			});
		}
	};

	/**
	 * Get PLC connection status
	 */
	getConnectionStatus = async (req, res) => {
		try {
			const status = plcService.getConnectionStatus();

			res.json({
				success: true,
				data: status,
			});
		} catch (error) {
			logger.error('Error getting PLC connection status:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
				error: error.message,
			});
		}
	};

	/**
	 * Read chamber-specific sensor values (for integration with chambers)
	 */
	readChamberSensors = async (req, res) => {
		try {
			const { chamberId } = req.params;

			// Validate chamber ID
			if (!chamberId || (chamberId !== '1' && chamberId !== '2')) {
				return res.status(400).json({
					success: false,
					message: 'Invalid chamber ID. Use 1 for Main or 2 for Entry',
				});
			}

			const result = await plcService.readRawValues();

			if (!result.success) {
				return res.status(500).json({
					success: false,
					message: 'Failed to read from PLC',
					error: result.error,
					connectionStatus: plcService.getConnectionStatus(),
				});
			}

			// Map chamber ID to sensor indices (this is application-specific)
			// You may need to adjust these mappings based on your hardware setup
			let sensorIndices;
			if (chamberId === '1') {
				// Main chamber
				sensorIndices = [0, 1, 2, 3]; // First 4 sensors for main chamber
			} else {
				// Entry chamber
				sensorIndices = [4, 5, 6, 7]; // Next 4 sensors for entry chamber
			}

			const chamberData = {
				chamberId: parseInt(chamberId),
				sensors: sensorIndices.map((index) => ({
					index: index,
					value: result.data[index] || 0,
					timestamp: result.timestamp,
				})),
				timestamp: result.timestamp,
			};

			// Broadcast chamber-specific data via Socket.IO
			const socketHandler = getSocketHandler();
			if (socketHandler) {
				socketHandler.broadcastChamberSensorData(chamberId, chamberData);
			}

			res.json({
				success: true,
				data: chamberData,
				metadata: {
					isConnectedPLC: result.isConnectedPLC,
					totalSensors: result.data.length,
				},
			});
		} catch (error) {
			logger.error('Error in readChamberSensors controller:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
				error: error.message,
			});
		}
	};

	/**
	 * Convert raw sensor value to O2 percentage (basic conversion)
	 * This is a utility endpoint for testing purposes
	 */
	convertRawToO2 = async (req, res) => {
		try {
			const { rawValue, minRaw, maxRaw, minO2, maxO2 } = req.body;

			// Default conversion parameters (you may need to adjust these)
			const minRawValue = minRaw || 2500;
			const maxRawValue = maxRaw || 16383;
			const minO2Value = minO2 || 0;
			const maxO2Value = maxO2 || 100;

			if (rawValue === undefined || rawValue === null) {
				return res.status(400).json({
					success: false,
					message: 'rawValue is required',
				});
			}

			// Linear conversion formula
			const o2Percentage =
				((rawValue - minRawValue) / (maxRawValue - minRawValue)) *
					(maxO2Value - minO2Value) +
				minO2Value;

			const clampedO2 = Math.max(
				minO2Value,
				Math.min(maxO2Value, o2Percentage)
			);

			res.json({
				success: true,
				data: {
					rawValue: rawValue,
					o2Percentage: Math.round(clampedO2 * 100) / 100, // Round to 2 decimal places
					conversionParams: {
						minRaw: minRawValue,
						maxRaw: maxRawValue,
						minO2: minO2Value,
						maxO2: maxO2Value,
					},
					timestamp: new Date().toISOString(),
				},
			});
		} catch (error) {
			logger.error('Error in convertRawToO2 controller:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
				error: error.message,
			});
		}
	};

	/**
	 * Get periodic PLC reader status
	 */
	getPeriodicReaderStatus = async (req, res) => {
		try {
			const stats = periodicPLCReader.getStats();

			res.json({
				success: true,
				data: stats,
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			logger.error('Error getting periodic reader status:', error);
			res.status(500).json({
				success: false,
				message: 'Internal server error',
				error: error.message,
			});
		}
	};

	/**
	 * Start periodic PLC reader
	 */
	startPeriodicReader = async (req, res) => {
		try {
			periodicPLCReader.start();

			res.json({
				success: true,
				message: 'Periodic PLC reader started successfully',
				data: periodicPLCReader.getStats(),
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			logger.error('Error starting periodic reader:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to start periodic reader',
				error: error.message,
			});
		}
	};

	/**
	 * Stop periodic PLC reader
	 */
	stopPeriodicReader = async (req, res) => {
		try {
			periodicPLCReader.stop();

			res.json({
				success: true,
				message: 'Periodic PLC reader stopped successfully',
				data: periodicPLCReader.getStats(),
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			logger.error('Error stopping periodic reader:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to stop periodic reader',
				error: error.message,
			});
		}
	};

	/**
	 * Update periodic PLC reader interval
	 */
	updatePeriodicReaderInterval = async (req, res) => {
		try {
			const { interval } = req.body;

			periodicPLCReader.updateInterval(interval);

			res.json({
				success: true,
				message: `Periodic PLC reader interval updated to ${interval}ms`,
				data: periodicPLCReader.getStats(),
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			logger.error('Error updating periodic reader interval:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to update interval',
				error: error.message,
			});
		}
	};
}

module.exports = new PLCController();
