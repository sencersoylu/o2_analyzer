const express = require('express');
const router = express.Router();
const chamberController = require('../controllers/chamberController');
const {
	validateChamber,
	validateO2Reading,
} = require('../middleware/validation');

// Chamber Management
router.get('/', chamberController.getAllChambers);
router.get('/:id', chamberController.getChamberById);
router.post('/', validateChamber, chamberController.createChamber);
router.put('/:id', validateChamber, chamberController.updateChamber);
router.delete('/:id', chamberController.deleteChamber);

// Alarm Level Management
router.put('/:id/alarm-level', chamberController.updateHighAlarmLevel);

// O2 Readings
router.get('/:id/readings', chamberController.getChamberReadings);
router.get('/:id/readings/latest', chamberController.getLatestReading);
router.post('/:id/readings', validateO2Reading, chamberController.addReading);
router.post('/:id/readings/plc', chamberController.addReadingFromPLC);
router.get('/:id/readings/history', chamberController.getHistoricalData);

module.exports = router;
