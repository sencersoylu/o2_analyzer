const { sequelize, Chamber, ChamberSettings } = require('../src/models');
const logger = require('../src/utils/logger');

async function seedDatabase() {
	try {
		logger.info('Starting database seeding...');

		// Sync database
		await sequelize.sync({ force: true });
		logger.info('Database synced');

		// Create Main chamber
		const mainChamber = await Chamber.create({
			name: 'Main',
			description: 'Ana O2 analizör kabini',
			isActive: true,
		});

		// Create Entry chamber
		const entryChamber = await Chamber.create({
			name: 'Entry',
			description: 'Giriş O2 analizör kabini',
			isActive: true,
		});

		// Create default settings for Main chamber
		await ChamberSettings.create({
			chamberId: mainChamber.id,
			alarmLevelHigh: 24.0, // %24 üst alarm seviyesi
			alarmLevelLow: 16.0, // %16 alt alarm seviyesi
			sensorModel: 'O2-Sensor-Main',
			sensorSerialNumber: 'MAIN-001',
			isCalibrationRequired: true, // İlk kurulumda kalibrasyon gerekli
		});

		// Create default settings for Entry chamber
		await ChamberSettings.create({
			chamberId: entryChamber.id,
			alarmLevelHigh: 24.0, // %24 üst alarm seviyesi
			alarmLevelLow: 16.0, // %16 alt alarm seviyesi
			sensorModel: 'O2-Sensor-Entry',
			sensorSerialNumber: 'ENTRY-001',
			isCalibrationRequired: true, // İlk kurulumda kalibrasyon gerekli
		});

		logger.info('Database seeded successfully');
		logger.info(
			`Created chambers: ${mainChamber.name} (ID: ${mainChamber.id}), ${entryChamber.name} (ID: ${entryChamber.id})`
		);

		process.exit(0);
	} catch (error) {
		logger.error('Error seeding database:', error);
		process.exit(1);
	}
}

// Run seeding if this file is executed directly
if (require.main === module) {
	seedDatabase();
}

module.exports = seedDatabase;
