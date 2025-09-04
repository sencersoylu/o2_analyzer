const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const O2Reading = sequelize.define(
	'O2Reading',
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		chamberId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			references: {
				model: 'chambers',
				key: 'id',
			},
		},
		o2Level: {
			type: DataTypes.DECIMAL(5, 2),
			allowNull: false,
			validate: {
				min: 0,
				max: 100,
			},
		},
		temperature: {
			type: DataTypes.DECIMAL(5, 2),
			allowNull: true,
			validate: {
				min: -50,
				max: 100,
			},
		},
		humidity: {
			type: DataTypes.DECIMAL(5, 2),
			allowNull: true,
			validate: {
				min: 0,
				max: 100,
			},
		},
		timestamp: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW,
		},
		sensorStatus: {
			type: DataTypes.ENUM('normal', 'warning', 'error'),
			allowNull: false,
			defaultValue: 'normal',
		},
	},
	{
		tableName: 'o2_readings',
		timestamps: true,
	}
);

module.exports = O2Reading;
