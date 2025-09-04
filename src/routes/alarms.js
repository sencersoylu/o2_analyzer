const express = require('express');
const router = express.Router();
const alarmController = require('../controllers/alarmController');
const { validateAlarmMute } = require('../middleware/validation');

// Alarm Management
router.get('/', alarmController.getActiveAlarms);
router.get('/history', alarmController.getAlarmHistory);
router.get('/stats', alarmController.getAlarmStats);
router.get('/:id', alarmController.getChamberAlarms);
router.post('/:id/mute', validateAlarmMute, alarmController.muteAlarm);
router.post('/:id/resolve', alarmController.resolveAlarm);

module.exports = router;
