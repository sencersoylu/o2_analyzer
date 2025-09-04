const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage: process.env.DATABASE_URL || './database.sqlite',
	logging: process.env.NODE_ENV === 'development' ? console.log : false,
	define: {
		timestamps: true,
		underscored: true,
	},
});

const testConnection = async () => {
	try {
		await sequelize.authenticate();
		console.log('Database connection established successfully.');
	} catch (error) {
		console.error('Unable to connect to the database:', error);
	}
};

module.exports = { sequelize, testConnection };
