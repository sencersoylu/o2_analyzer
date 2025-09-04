const { sequelize } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function migrate() {
	try {
		logger.info('Starting database migration...');

		// Import all models to ensure they are registered
		require('../src/models');

		// Sync database with force option to recreate tables
		await sequelize.sync({ force: true });

		logger.info('Database migration completed successfully');
		logger.info('All tables have been created');

		// Close database connection
		await sequelize.close();
		process.exit(0);
	} catch (error) {
		logger.error('Migration failed:', error);
		process.exit(1);
	}
}

// Run migration if this file is executed directly
if (require.main === module) {
	migrate();
}

module.exports = migrate;
