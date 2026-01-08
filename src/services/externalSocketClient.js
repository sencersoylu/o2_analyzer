/**
 * External Socket.IO Client (v2.x compatible)
 * Connects to an external server and forwards O2 level data
 */

const ioClient = require('socket.io-client');
const logger = require('../utils/logger');

class ExternalSocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.serverUrl = process.env.EXTERNAL_SOCKET_URL || 'http://192.168.77.100:4000';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
    }

    /**
     * Connect to the external Socket.IO server
     */
    connect() {
        if (this.socket) {
            logger.warn('External socket client already initialized');
            return;
        }

        logger.info(`Connecting to external socket server: ${this.serverUrl}`);

        // Socket.IO v2.x connection options
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

    /**
     * Setup socket event handlers
     */
    setupEventHandlers() {
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            logger.info(`Connected to external socket server: ${this.serverUrl} (ID: ${this.socket.id})`);
        });

        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            logger.warn(`Disconnected from external socket server: ${reason}`);
        });

        this.socket.on('connect_error', (error) => {
            this.reconnectAttempts++;
            logger.error(`External socket connection error (attempt ${this.reconnectAttempts}): ${error.message || error}`);
        });

        this.socket.on('reconnect', (attemptNumber) => {
            logger.info(`Reconnected to external socket server after ${attemptNumber} attempts`);
        });

        this.socket.on('reconnect_failed', () => {
            logger.error('Failed to reconnect to external socket server after maximum attempts');
        });

        // Socket.IO v2.x specific events
        this.socket.on('error', (error) => {
            logger.error(`External socket error: ${error.message || error}`);
        });

        this.socket.on('connect_timeout', () => {
            logger.warn('External socket connection timeout');
        });
    }

    /**
     * Emit O2 level data to external server
     * @param {number} chamberId - Chamber ID
     * @param {number} o2Level - Calibrated O2 level percentage
     * @param {number} rawValue - Raw sensor value (optional)
     */
    emitO2Level(chamberId, o2Level, rawValue = null) {
        if (!this.isConnected) {
            logger.debug(`Cannot emit O2 level - not connected to external server`);
            return false;
        }

        const data = {
            chamberId,
            o2Level,
            rawValue,
            timestamp: new Date().toISOString(),
        };

        this.socket.emit('o2-level', data);
        logger.debug(`Emitted o2-level to external server: Chamber ${chamberId} = ${o2Level}%`);
        return true;
    }

    /**
     * Emit multiple chamber O2 levels at once
     * @param {Array} chambers - Array of { chamberId, o2Level, rawValue }
     */
    emitMultipleO2Levels(chambers) {
        if (!this.isConnected) {
            logger.warn(`Cannot emit O2 levels - not connected to external server`);
            return false;
        }

        const data = {
            chambers: chambers.map(c => ({
                chamberId: c.chamberId,
                o2Level: c.o2Level,
                rawValue: c.rawValue || null,
            })),
            timestamp: new Date().toISOString(),
        };

        this.socket.emit('o2-level', data);
        logger.debug(`Emitted o2-level for ${chambers.length} chambers to external server`);
        return true;
    }

    /**
     * Disconnect from external server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            logger.info('Disconnected from external socket server');
        }
    }

    /**
     * Get connection status
     */
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
const externalSocketClient = new ExternalSocketClient();
module.exports = externalSocketClient;
