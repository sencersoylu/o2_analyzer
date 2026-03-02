/**
 * Modbus TCP Socket.IO Client
 * Connects to an external Modbus TCP bridge server via Socket.IO,
 * listens for 'modbus_data' events, processes sensor data (calibration,
 * DB storage, alarm checks for chambers), and relays to frontend clients.
 */

const ioClient = require('socket.io-client');
const logger = require('../utils/logger');
const { Chamber, O2Reading } = require('../models');
const calibrationService = require('./calibrationService');
const alarmService = require('./alarmService');

// Name-to-Chamber mapping (populated on first data event)
const NAME_TO_CHAMBER_CACHE = {};

class ModbusSocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.serverUrl = process.env.MODBUS_SOCKET_URL || 'http://localhost:5001';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
    }

    connect() {
        if (this.socket) {
            logger.warn('Modbus socket client already initialized');
            return;
        }

        logger.info(`Connecting to Modbus socket server: ${this.serverUrl}`);

        this.socket = ioClient(this.serverUrl, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: this.maxReconnectAttempts,
            timeout: 10000,
            transports: ['websocket', 'polling'],
            forceNew: true,
        });

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            logger.info(`Connected to Modbus socket server: ${this.serverUrl} (ID: ${this.socket.id})`);
        });

        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            logger.warn(`Disconnected from Modbus socket server: ${reason}`);
        });

        this.socket.on('connect_error', (error) => {
            this.reconnectAttempts++;
            logger.error(`Modbus socket connection error (attempt ${this.reconnectAttempts}): ${error.message || error}`);
        });

        this.socket.on('reconnect', (attemptNumber) => {
            logger.info(`Reconnected to Modbus socket server after ${attemptNumber} attempts`);
        });

        this.socket.on('reconnect_failed', () => {
            logger.error('Failed to reconnect to Modbus socket server after maximum attempts');
        });

        this.socket.on('error', (error) => {
            logger.error(`Modbus socket error: ${error.message || error}`);
        });

        this.socket.on('connect_timeout', () => {
            logger.warn('Modbus socket connection timeout');
        });

        // Listen for modbus_data, process and relay to frontend clients
        this.socket.on('modbus_data', async (data) => {
            logger.debug(`Received modbus_data: ${JSON.stringify(data)}`);

            // Relay raw modbus_data to frontend as-is
            if (global.socketHandler) {
                global.socketHandler.io.emit('modbus_data', data);
            }

            // Process each sensor entry
            await this.processModbusData(data);
        });
    }

    /**
     * Process incoming modbus_data array.
     * Each entry: { slave_id, name, giris_degeri, ortam_sicakligi, error }
     * Known names: main, ante, fio1-fio5
     */
    async processModbusData(data) {
        if (!Array.isArray(data)) {
            logger.warn('modbus_data is not an array, skipping processing');
            return;
        }

        for (const entry of data) {
            try {
                const { name, giris_degeri, ortam_sicakligi } = entry;

                if (!name) continue;

                // Skip entries with errors
                if (entry.error || giris_degeri === undefined || giris_degeri === null) {
                    logger.debug(`Skipping sensor ${name}: error or no value`);
                    continue;
                }

                // Find the chamber record by name
                const chamber = await this.findChamberByName(name);
                if (!chamber) {
                    logger.debug(`No chamber found for sensor name: ${name}`);
                    continue;
                }

                const rawValue = typeof giris_degeri === 'number' ? giris_degeri : parseFloat(giris_degeri);
                if (isNaN(rawValue)) {
                    logger.warn(`Invalid giris_degeri for sensor ${name}: ${giris_degeri}`);
                    continue;
                }

                const temperature = ortam_sicakligi != null ? parseFloat(ortam_sicakligi) : null;

                // Update lastRawFromPLC
                await chamber.update({ lastRawFromPLC: rawValue });

                // Calibrate the reading
                const calibratedO2Level = await calibrationService.calibrateReading(
                    chamber.id,
                    rawValue
                );

                // Skip O2Reading if no calibration exists (raw value returned as-is, exceeds 0-100 range)
                if (calibratedO2Level < 0 || calibratedO2Level > 100) {
                    logger.debug(`Skipping O2Reading for ${name}: uncalibrated value ${calibratedO2Level} out of range`);
                    continue;
                }

                // Create O2Reading record
                const reading = await O2Reading.create({
                    chamberId: chamber.id,
                    o2Level: calibratedO2Level,
                    temperature: isNaN(temperature) ? null : temperature,
                    humidity: null,
                    sensorStatus: 'normal',
                    timestamp: new Date(),
                });

                logger.debug(
                    `Processed ${name} (chamber ${chamber.id}) - Raw: ${rawValue}, Calibrated: ${calibratedO2Level}%, Temp: ${temperature}`
                );

                // Alarm check only for chamber type (not FIO sensors)
                if (chamber.type === 'chamber') {
                    try {
                        await alarmService.checkForAlarms(chamber.id, calibratedO2Level, 'normal');
                        await alarmService.resolveAlarms(chamber.id, calibratedO2Level, 'normal');
                    } catch (alarmError) {
                        logger.error(`Alarm check failed for chamber ${chamber.id}:`, alarmError);
                    }
                }

                // Broadcast via Socket.IO
                const socketHandler = global.socketHandler;
                if (socketHandler) {
                    socketHandler.broadcastChamberRawValue(chamber.id, {
                        chamberId: chamber.id,
                        chamberName: chamber.name,
                        lastRawFromPLC: rawValue,
                        temperature,
                        timestamp: new Date().toISOString(),
                    });

                    socketHandler.broadcastNewReading(chamber.id, {
                        ...reading.toJSON(),
                        rawO2Level: rawValue,
                        convertedO2Level: calibratedO2Level,
                    });
                }
            } catch (error) {
                logger.error(`Error processing modbus entry ${entry?.name}:`, error);
            }
        }
    }

    /**
     * Find chamber by name, with caching.
     */
    async findChamberByName(name) {
        const normalizedName = name.toLowerCase();

        if (NAME_TO_CHAMBER_CACHE[normalizedName]) {
            // Re-fetch to get latest field values
            const cached = NAME_TO_CHAMBER_CACHE[normalizedName];
            return await Chamber.findByPk(cached.id);
        }

        const sequelize = require('sequelize');
        const chamber = await Chamber.findOne({
            where: sequelize.where(
                sequelize.fn('LOWER', sequelize.col('name')),
                normalizedName
            )
        });
        if (chamber) {
            NAME_TO_CHAMBER_CACHE[normalizedName] = { id: chamber.id };
            return chamber;
        }

        return null;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            logger.info('Disconnected from Modbus socket server');
        }
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            serverUrl: this.serverUrl,
            socketId: this.socket?.id || null,
            reconnectAttempts: this.reconnectAttempts,
        };
    }
}

// Export singleton instance
const modbusSocketClient = new ModbusSocketClient();
module.exports = modbusSocketClient;
