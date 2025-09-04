const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Alarm = sequelize.define(
	'Alarm',
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
		alarmType: {
			type: DataTypes.ENUM(
				'high_o2',
				'low_o2',
				'sensor_error',
				'calibration_due'
			),
			allowNull: false,
		},
		isActive: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		},
		isMuted: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		mutedUntil: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		triggeredAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW,
		},
		resolvedAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		o2LevelWhenTriggered: {
			type: DataTypes.DECIMAL(5, 2),
			allowNull: true,
		},
	},
	{
		tableName: 'alarms',
		timestamps: true,
	}
);

module.exports = Alarm;
