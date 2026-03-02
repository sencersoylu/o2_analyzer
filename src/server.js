const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const compression = require('compression');
require('dotenv').config();

// Import configurations and middleware
const { sequelize, testConnection } = require('./config/database');
const { setupSecurity } = require('./middleware/security');
const logger = require('./utils/logger');

// Import models to ensure they are registered
require('./models');

// Import routes
const chamberRoutes = require('./routes/chambers');
const alarmRoutes = require('./routes/alarms');
const settingsRoutes = require('./routes/settings');
const analyticsRoutes = require('./routes/analytics');
const plcRoutes = require('./routes/plc');

// Import Socket.IO handler
const SocketHandler = require('./sockets/socketHandler');

// Import periodic PLC reader
const periodicPLCReader = require('./services/periodicPlcReader');
const periodicDataService = require('./services/periodicDataService');
const externalSocketClient = require('./services/externalSocketClient');
const modbusSocketClient = require('./services/modbusSocketClient');

const DATA_SOURCE = (process.env.DATA_SOURCE || 'plc').toLowerCase();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
	cors: {
		origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
		methods: ['GET', 'POST'],
	},
});

// Initialize Socket.IO handler
const socketHandler = new SocketHandler(io);

// Make socketHandler available globally
global.socketHandler = socketHandler;



// Middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
setupSecurity(app);

// Request logging middleware
app.use((req, res, next) => {
	logger.info(`${req.method} ${req.path} - ${req.ip}`);
	next();
});

// Health check endpoint
app.get('/health', (req, res) => {
	res.json({
		status: 'OK',
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		environment: process.env.NODE_ENV,
		connectedClients: socketHandler.getConnectedClientsCount(),
		periodicPlcReader: periodicPLCReader.getStats(),
	});
});

// API routes
app.use('/api/chambers', chamberRoutes);
app.use('/api/alarms', alarmRoutes);
app.use('/api/settings', settingsRoutes); // Settings routes
app.use('/api/analytics', analyticsRoutes);
app.use('/api/plc', plcRoutes);

// Root endpoint
app.get('/', (req, res) => {
	res.json({
		message: 'O2 Analyzer Backend API',
		version: '1.0.0',
		endpoints: {
			chambers: '/api/chambers',
			alarms: '/api/alarms',
			settings: '/api/settings',
			analytics: '/api/analytics',
			plc: '/api/plc',
			health: '/health',
		},
		documentation: 'API documentation available at /docs (if implemented)',
	});
});

// 404 handler
app.use('*', (req, res) => {
	res.status(404).json({
		success: false,
		message: 'Endpoint not found',
		path: req.originalUrl,
	});
});

// Global error handler
app.use((error, req, res, next) => {
	logger.error('Unhandled error:', error);

	res.status(500).json({
		success: false,
		message: 'Internal server error',
		...(process.env.NODE_ENV === 'development' && { error: error.message }),
	});
});

// Database connection and server startup
const PORT = process.env.PORT || 3001;

async function startServer() {
	try {
		// Test database connection
		await testConnection();

		// Sync database models
		await sequelize.sync();
		logger.info('Database synchronized successfully');

		// SQLite migrations
		const Chamber = require('./models/Chamber');
		try {
			const tableInfo = await sequelize.getQueryInterface().describeTable('chambers');
			// Add 'type' column if it doesn't exist
			if (!tableInfo.type) {
				await sequelize.getQueryInterface().addColumn('chambers', 'type', {
					type: require('sequelize').DataTypes.STRING,
					allowNull: false,
					defaultValue: 'chamber',
				});
				logger.info('Added "type" column to chambers table');
			}
			// Fix lastRawFromPLC column: INTEGER → REAL for decimal Modbus values
			if (tableInfo.last_raw_from_p_l_c && tableInfo.last_raw_from_p_l_c.type === 'INTEGER') {
				await sequelize.query('ALTER TABLE chambers RENAME COLUMN last_raw_from_p_l_c TO last_raw_from_p_l_c_old');
				await sequelize.query('ALTER TABLE chambers ADD COLUMN last_raw_from_p_l_c REAL');
				await sequelize.query('UPDATE chambers SET last_raw_from_p_l_c = NULL');
				await sequelize.query('ALTER TABLE chambers DROP COLUMN last_raw_from_p_l_c_old');
				logger.info('Migrated lastRawFromPLC column from INTEGER to REAL');
			}
		} catch (err) {
			logger.warn('Migration warning:', err.message);
		}

		// Create FIO sensor records if they don't exist
		const fioSensors = ['fio1', 'fio2', 'fio3', 'fio4', 'fio5'];
		for (const name of fioSensors) {
			await Chamber.findOrCreate({
				where: { name },
				defaults: { name, type: 'fio' },
			});
		}
		logger.info('FIO sensor records ensured in database');

		// Start server
		server.listen(PORT, () => {
			logger.info(`Server running on port ${PORT}`);
			logger.info(`Environment: ${process.env.NODE_ENV}`);
			logger.info(`Health check: http://localhost:${PORT}/health`);

			logger.info(`Data source mode: ${DATA_SOURCE}`);

			if (DATA_SOURCE === 'tcpmodbus') {
				// tcpmodbus mode: connect to Modbus TCP bridge server
				try {
					modbusSocketClient.connect();
					logger.info('Modbus socket client started successfully');
				} catch (error) {
					logger.error('Failed to start Modbus socket client:', error);
				}

				try {
					periodicDataService.startBroadcast(socketHandler);
				} catch (error) {
					logger.error('Failed to start periodic chamber data broadcast:', error);
				}
			} else {
				// plc mode (default): start PLC reader + periodic data + external socket
				try {
					periodicPLCReader.start();
					logger.info('Periodic PLC reader started successfully');
				} catch (error) {
					logger.error('Failed to start periodic PLC reader:', error);
				}

				try {
					periodicDataService.startBroadcast(socketHandler);
				} catch (error) {
					logger.error('Failed to start periodic chamber data broadcast:', error);
				}

				try {
					externalSocketClient.connect();
				} catch (error) {
					logger.error('Failed to connect to external socket server:', error);
				}
			}
		});
	} catch (error) {
		logger.error('Failed to start server:', error);
		process.exit(1);
	}
}

// Graceful shutdown
process.on('SIGTERM', () => {
	logger.info('SIGTERM received, shutting down gracefully');

	if (DATA_SOURCE === 'tcpmodbus') {
		try {
			modbusSocketClient.disconnect();
			logger.info('Modbus socket client disconnected');
		} catch (error) {
			logger.error('Error disconnecting Modbus socket client:', error);
		}

		try {
			periodicDataService.stopBroadcast();
		} catch (error) {
			logger.error('Error stopping periodic chamber data broadcast:', error);
		}
	} else {
		try {
			periodicPLCReader.stop();
			logger.info('Periodic PLC reader stopped');
		} catch (error) {
			logger.error('Error stopping periodic PLC reader:', error);
		}

		try {
			periodicDataService.stopBroadcast();
		} catch (error) {
			logger.error('Error stopping periodic chamber data broadcast:', error);
		}

		try {
			externalSocketClient.disconnect();
			logger.info('External socket client disconnected');
		} catch (error) {
			logger.error('Error disconnecting external socket client:', error);
		}
	}

	server.close(() => {
		logger.info('Server closed');
		sequelize.close();
		process.exit(0);
	});
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
	logger.error('Uncaught Exception:', error);
	process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
	process.exit(1);
});

// Start the server
startServer();

module.exports = { app, server, io };
