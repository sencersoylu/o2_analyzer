const net = require('net');
const logger = require('../utils/logger');

class PLCService {
	constructor() {
		this.isWorking = false;
		this.isConnectedPLC = 0; // 0: disconnected, 1: connected, 2: error
		this.sensorData = [];
		this.connectionTimeout = 250;
		this.demo = process.env.DEMO_MODE || 0;

		// PLC configuration from environment variables
		this.plcIP = process.env.PLC_IP || '192.168.1.3';
		this.plcPort = process.env.PLC_PORT || 500;
	}

	/**
	 * Calculate LRC (Longitudinal Redundancy Check) for the buffer
	 * @param {Buffer} buf - Buffer to calculate LRC for
	 * @returns {string} - LRC as hex string
	 */
	calculateLRC(buf) {
		let lrc = 0;
		for (let i = 0; i < buf.length; i++) {
			lrc += buf[i];
		}
		return (lrc & 0xff).toString(16);
	}

	/**
	 * Open connection to PLC
	 * @returns {Promise<net.Socket>} - Connected socket
	 */
	async openClientConnection() {
		return new Promise((resolve, reject) => {
			try {
				//console.log("openClientConnection");
				const client = new net.Socket();

				client.connect(this.plcPort, this.plcIP);

				client.setTimeout(this.connectionTimeout, () => {
					this.isConnectedPLC = 2;
					client.end();
					reject(new Error('Connection timeout'));
				});

				client.on('ready', () => {
					this.isConnectedPLC = 1;
					logger.info(`PLC connected to ${this.plcIP}:${this.plcPort}`);
					resolve(client);
				});

				client.on('error', (err) => {
					this.isConnectedPLC = 2;
					logger.error('PLC connection error:', err);
					reject(new Error('Connection error'));
				});

				client.on('data', (data) => {
					try {
						client.destroy();

						logger.debug(
							`Received PLC data: ${data}, size: ${client.bytesRead}`
						);

						const test = Buffer.from(data.slice(0, 4), 'hex');
						if (
							Buffer.compare(test, Buffer.from([0x02, 0x30, 0x31, 0x34])) === 0
						) {
							const buff = Buffer.from(data.slice(6, data.length - 3), 'hex');
							const size = buff.length / 4;

							// Clear previous data
							this.sensorData = [];

							// Parse sensor data
							for (let index = 0; index < size; index++) {
								this.sensorData[index] = parseInt(
									buff.slice(index * 4, index * 4 + 4).toString(),
									16
								);
							}

							console.log(this.sensorData)

							logger.debug('Parsed sensor data:', this.sensorData);
						}
					} catch (error) {
						logger.error('Error parsing PLC data:', error);
					}
				});
			} catch (err) {
				logger.error('Error creating PLC connection:', err);
				reject(err);
			}
		});
	}

	/**
	 * Read raw values from PLC register R02000
	 * @param {number} numValues - Number of values to read (default: 19)
	 * @returns {Promise<Array>} - Array of raw sensor values
	 */
	async readRawValues(numValues = 19) {
		try {
			if (this.demo == 1) {
				// Return demo data if in demo mode
				const { Chance } = require('chance');
				const chance = new Chance();
				const demoData = [];

				for (let i = 0; i < numValues; i++) {
					if (i === 10) {
						demoData.push(0); // One zero value as in original
					} else {
						demoData.push(chance.integer({ min: 2500, max: 16383 }));
					}
				}

				logger.info('Returning demo PLC data');
				return {
					success: true,
					isConnectedPLC: 1,
					data: demoData,
					timestamp: new Date().toISOString(),
				};
			}

			if (this.isWorking) {
				throw new Error('PLC operation already in progress');
			}

			console.log("working readRawValues")
			this.isWorking = true;
			const client = await this.openClientConnection();

			// Build read command for R02000 register
			const buf1 = Buffer.from(
				[
					0x02,
					'0'.charCodeAt(),
					'1'.charCodeAt(),
					'4'.charCodeAt(),
					'6'.charCodeAt(),
					'0'.charCodeAt(),
					'2'.charCodeAt(),
				],
				'ascii'
			);

			// Register address R02000
			const buf2 = Buffer.from('R02100');
			const bufA = Buffer.concat([buf1, buf2], buf1.length + buf2.length);

			// Calculate and append LRC
			const LRC = this.calculateLRC(bufA);
			const bufB = Buffer.concat([
				bufA,
				Buffer.from([LRC[0].charCodeAt(), LRC[1].charCodeAt(), 0x03]),
			]);

			// Send read command
			await client.write(bufB);

			// Wait for response and return data
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					this.isWorking = false;
					reject(new Error('Read operation timeout'));
				}, 1000);

				// Data will be parsed in the 'data' event handler
				const checkData = setInterval(() => {
					if (this.sensorData.length > 0) {
						clearTimeout(timeout);
						clearInterval(checkData);
						this.isWorking = false;

						resolve({
							success: true,
							isConnectedPLC: this.isConnectedPLC,
							data: this.sensorData.slice(0, numValues),
							timestamp: new Date().toISOString(),
						});
					}
				}, 50);
			});
		} catch (error) {
			this.isWorking = false;
			this.isConnectedPLC = 0;
			logger.error('Error reading raw values from PLC:', error);

			return {
				success: false,
				isConnectedPLC: this.isConnectedPLC,
				error: error.message,
				timestamp: new Date().toISOString(),
			};
		}
	}

	/**
	 * Read a specific sensor value by index
	 * @param {number} sensorIndex - Index of the sensor (0-based)
	 * @returns {Promise<Object>} - Sensor value and metadata
	 */
	async readSensorValue(sensorIndex) {
		try {
			//console.log("read value")
			const result = await this.readRawValues();

			if (!result.success) {
				return result;
			}

			if (sensorIndex < 0 || sensorIndex >= result.data.length) {
				return {
					success: false,
					error: `Invalid sensor index ${sensorIndex}. Available range: 0-${result.data.length - 1
						}`,
					timestamp: new Date().toISOString(),
				};
			}

			return {
				success: true,
				isConnectedPLC: result.isConnectedPLC,
				sensorIndex: sensorIndex,
				value: result.data[sensorIndex],
				allValues: result.data,
				timestamp: result.timestamp,
			};
		} catch (error) {
			logger.error(`Error reading sensor ${sensorIndex}:`, error);
			return {
				success: false,
				error: error.message,
				timestamp: new Date().toISOString(),
			};
		}
	}

	/**
	 * Get PLC connection status
	 * @returns {Object} - Connection status and info
	 */
	getConnectionStatus() {
		return {
			isConnected: this.isConnectedPLC === 1,
			connectionState: this.isConnectedPLC, // 0: disconnected, 1: connected, 2: error
			isWorking: this.isWorking,
			plcIP: this.plcIP,
			plcPort: this.plcPort,
			demoMode: this.demo == 1,
			timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Convert decimal to 4-character hex string
	 * @param {number} d - Decimal number
	 * @returns {string} - 4-character hex string
	 */
	d2h(d) {
		return ('0000' + (+d).toString(16)).slice(-4);
	}

	/**
	 * Write data to PLC register
	 * @param {string} registerAddress - Register address (e.g., 'R02001')
	 * @param {number} value - Value to write
	 * @returns {Promise<Object>} - Result of write operation
	 */
	async writeData(registerAddress, value) {
		try {
			if (this.demo == 1) {
				logger.info(`Demo mode: Would write ${value} to ${registerAddress}`);
				return {
					success: true,
					registerAddress,
					value,
					timestamp: new Date().toISOString(),
				};
			}

			// Wait if another operation is in progress
			while (this.isWorking) {
				await new Promise(resolve => setTimeout(resolve, 50));
			}

			this.isWorking = true;

			const buf1 = Buffer.from(
				[
					0x02,
					'0'.charCodeAt(),
					'1'.charCodeAt(),
					'4'.charCodeAt(),
					'7'.charCodeAt(),
					'0'.charCodeAt(),
					'1'.charCodeAt(),
				],
				'ascii'
			);

			const buf2 = Buffer.from(registerAddress, 'ascii');
			const buf3 = Buffer.from(this.d2h(parseInt(value)).toUpperCase(), 'ascii');

			const bufA = Buffer.concat(
				[buf1, buf2, buf3],
				buf1.length + buf2.length + buf3.length
			);

			const LRC = this.calculateLRC(bufA);
			const bufB = Buffer.concat([
				bufA,
				Buffer.from([LRC[0].charCodeAt(), LRC[1].charCodeAt(), 0x03]),
			]);

			logger.debug('Write data buffer:', bufB);

			// Open connection and send data
			const client = await this.openClientConnection();
			await client.write(bufB);

			// Wait a bit for the write to complete
			await new Promise(resolve => setTimeout(resolve, 100));
			client.destroy();

			this.isWorking = false;

			logger.info(`Wrote ${value} to PLC register ${registerAddress}`);
			return {
				success: true,
				registerAddress,
				value,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			this.isWorking = false;
			logger.error(`Error writing to PLC register ${registerAddress}:`, error);
			return {
				success: false,
				registerAddress,
				value,
				error: error.message,
				timestamp: new Date().toISOString(),
			};
		}
	}
}

module.exports = new PLCService();
