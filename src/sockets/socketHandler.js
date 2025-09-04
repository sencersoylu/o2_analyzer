const logger = require('../utils/logger');
const alarmService = require('../services/alarmService');

class SocketHandler {
	constructor(io) {
		this.io = io;
		this.connectedClients = new Map();
		this.setupEventHandlers();
	}

	setupEventHandlers() {
		this.io.on('connection', (socket) => {
			logger.info(`Client connected: ${socket.id}`);
			this.connectedClients.set(socket.id, socket);

			// Handle client joining specific chamber room
			socket.on('join-chamber', (chamberId) => {
				socket.join(`chamber-${chamberId}`);
				logger.info(`Client ${socket.id} joined chamber ${chamberId}`);
			});

			// Handle client leaving chamber room
			socket.on('leave-chamber', (chamberId) => {
				socket.leave(`chamber-${chamberId}`);
				logger.info(`Client ${socket.id} left chamber ${chamberId}`);
			});

			// Handle client joining global room
			socket.on('join-global', () => {
				socket.join('global');
				logger.info(`Client ${socket.id} joined global room`);
			});

			// Handle client disconnection
			socket.on('disconnect', () => {
				this.connectedClients.delete(socket.id);
				logger.info(`Client disconnected: ${socket.id}`);
			});

			// Handle ping/pong for connection health
			socket.on('ping', () => {
				socket.emit('pong', { timestamp: new Date().toISOString() });
			});
		});
	}

	// Broadcast new O2 reading to chamber room
	broadcastO2Reading(chamberId, reading) {
		this.io.to(`chamber-${chamberId}`).emit('o2-reading', {
			chamberId,
			reading,
			timestamp: new Date().toISOString(),
		});
		logger.info(
			`Broadcasted O2 reading for chamber ${chamberId}: ${reading.o2Level}%`
		);
	}

	// Broadcast alarm to global room and specific chamber room
	broadcastAlarm(alarm) {
		const alarmData = {
			alarm,
			timestamp: new Date().toISOString(),
		};

		// Broadcast to global room
		this.io.to('global').emit('alarm-triggered', alarmData);

		// Broadcast to specific chamber room
		this.io.to(`chamber-${alarm.chamberId}`).emit('alarm-triggered', alarmData);

		logger.info(
			`Broadcasted alarm for chamber ${alarm.chamberId}: ${alarm.alarmType}`
		);
	}

	// Broadcast alarm resolution
	broadcastAlarmResolved(alarm) {
		const alarmData = {
			alarm,
			timestamp: new Date().toISOString(),
		};

		// Broadcast to global room
		this.io.to('global').emit('alarm-resolved', alarmData);

		// Broadcast to specific chamber room
		this.io.to(`chamber-${alarm.chamberId}`).emit('alarm-resolved', alarmData);

		logger.info(
			`Broadcasted alarm resolution for chamber ${alarm.chamberId}: ${alarm.alarmType}`
		);
	}

	// Broadcast calibration event
	broadcastCalibration(chamberId, calibrationData) {
		this.io.to(`chamber-${chamberId}`).emit('calibration-performed', {
			chamberId,
			calibration: calibrationData,
			timestamp: new Date().toISOString(),
		});
		logger.info(`Broadcasted calibration for chamber ${chamberId}`);
	}

	// Broadcast settings update
	broadcastSettingsUpdate(chamberId, settings) {
		this.io.to(`chamber-${chamberId}`).emit('settings-updated', {
			chamberId,
			settings,
			timestamp: new Date().toISOString(),
		});
		logger.info(`Broadcasted settings update for chamber ${chamberId}`);
	}

	// Broadcast system status
	broadcastSystemStatus(status) {
		this.io.to('global').emit('system-status', {
			status,
			timestamp: new Date().toISOString(),
		});
		logger.info('Broadcasted system status update');
	}

	// Get connected clients count
	getConnectedClientsCount() {
		return this.connectedClients.size;
	}

	// Get connected clients info
	getConnectedClientsInfo() {
		const clients = [];
		this.connectedClients.forEach((socket, id) => {
			clients.push({
				id,
				connectedAt: socket.connectedAt || new Date(),
				rooms: Array.from(socket.rooms),
			});
		});
		return clients;
	}

	// Send message to specific client
	sendToClient(clientId, event, data) {
		const socket = this.connectedClients.get(clientId);
		if (socket) {
			socket.emit(event, data);
			return true;
		}
		return false;
	}

	// Broadcast to all connected clients
	broadcastToAll(event, data) {
		this.io.emit(event, {
			...data,
			timestamp: new Date().toISOString(),
		});
	}
}

module.exports = SocketHandler;
