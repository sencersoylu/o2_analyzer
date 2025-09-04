const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Chamber = sequelize.define(
	'Chamber',
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
			validate: {
				notEmpty: true,
				len: [1, 100],
			},
		},
		description: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		lastValue: {
			type: DataTypes.DECIMAL(5, 2),
			allowNull: true,
		},
		raw0: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		raw21: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		raw100: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		calibrationDate: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		alarmLevelHigh: {
			type: DataTypes.DECIMAL(5, 2),
			allowNull: false,
			defaultValue: 24.0,
		},
		alarmLevelLow: {
			type: DataTypes.DECIMAL(5, 2),
			allowNull: false,
			defaultValue: 16.0,
		},
		lastSensorChange: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		isActive: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},
	},
	{
		tableName: 'chambers',
		timestamps: true,
	}
);

module.exports = Chamber;
