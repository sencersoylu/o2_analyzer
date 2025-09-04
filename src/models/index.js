const { sequelize } = require('../config/database');

// Import models
const Chamber = require('./Chamber');
const O2Reading = require('./O2Reading');
const Alarm = require('./Alarm');

// Define associations
Chamber.hasMany(O2Reading, { foreignKey: 'chamberId', as: 'readings' });
O2Reading.belongsTo(Chamber, { foreignKey: 'chamberId', as: 'chamber' });

Chamber.hasMany(Alarm, { foreignKey: 'chamberId', as: 'alarms' });
Alarm.belongsTo(Chamber, { foreignKey: 'chamberId', as: 'chamber' });

module.exports = {
	sequelize,
	Chamber,
	O2Reading,
	Alarm,
};
