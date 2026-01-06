# Periodic PLC Reader

This document describes the periodic PLC reader functionality that automatically reads raw values from the PLC every 500ms and updates the `lastRawFromPLC` field in the Chamber table.

## Overview

The periodic PLC reader is a background service that:

- Reads raw sensor data from PLC register R02000 every 500ms
- Updates the `lastRawFromPLC` field for each active chamber
- Broadcasts real-time updates via Socket.IO
- Provides detailed monitoring and statistics

## Features

### Automatic Startup

- Starts automatically when the server starts
- Gracefully stops when the server shuts down
- Includes error handling and recovery

### Chamber Mapping

The reader uses a configurable sensor mapping:

- Chamber 1 (Main): Sensor index 0
- Chamber 2 (Entry): Sensor index 4

### Real-time Updates

- Broadcasts chamber raw values via Socket.IO
- Events: `chamber-raw-value` for specific chambers and `global` room
- Includes timestamp and sensor metadata

## API Endpoints

### Get Status

```
GET /api/plc/periodic-reader/status
```

Returns the current status, statistics, and configuration.

### Start Reader

```
POST /api/plc/periodic-reader/start
```

Manually start the periodic reader (if stopped).

### Stop Reader

```
POST /api/plc/periodic-reader/stop
```

Manually stop the periodic reader.

### Update Interval

```
POST /api/plc/periodic-reader/interval
Content-Type: application/json

{
  "interval": 1000
}
```

Update the reading interval (minimum 100ms).

## Database Schema

The `lastRawFromPLC` field is added to the Chamber model:

```sql
ALTER TABLE chambers ADD COLUMN lastRawFromPLC INTEGER;
```

## Socket.IO Events

### Chamber Raw Value Event

```javascript
socket.on('chamber-raw-value', (data) => {
	console.log('Chamber raw value:', data);
	// {
	//   chamberId: 1,
	//   chamberName: "Main",
	//   lastRawFromPLC: 12345,
	//   sensorIndex: 0,
	//   timestamp: "2025-09-11T10:30:00.000Z"
	// }
});
```

## Health Monitoring

The periodic reader status is included in the health check endpoint:

```
GET /health
```

Response includes:

```json
{
	"status": "OK",
	"periodicPlcReader": {
		"isRunning": true,
		"interval": 500,
		"lastReadAttempt": "2025-09-11T10:30:00.000Z",
		"successfulReads": 1200,
		"failedReads": 5,
		"successRate": "99.58%",
		"chamberSensorMapping": {
			"1": 0,
			"2": 4
		}
	}
}
```

## Configuration

### Environment Variables

The PLC connection uses these environment variables:

- `PLC_IP`: PLC IP address (default: 192.168.1.3)
- `PLC_PORT`: PLC port (default: 500)
- `DEMO_MODE`: Set to 1 for demo mode (generates fake data)

### Demo Mode

When `DEMO_MODE=1`, the reader generates random demo data instead of connecting to a real PLC.

## Error Handling

The service includes comprehensive error handling:

- PLC connection failures are logged but don't stop the service
- Database update errors are logged per chamber
- Statistics track success/failure rates
- Automatic retry on next interval

## Logging

The service uses different log levels:

- `info`: Startup, shutdown, interval changes
- `debug`: Individual chamber updates, raw values
- `error`: Connection failures, database errors
- Statistics are logged every 100 successful reads

## Performance Considerations

- Default 500ms interval provides real-time updates
- Minimum interval is 100ms for safety
- Uses efficient database updates with minimal queries
- Socket.IO broadcasts use debug level to reduce log noise

## Integration

The periodic reader integrates with:

- Chamber model for data storage
- Socket.IO for real-time broadcasts
- PLC service for data reading
- Logger for monitoring
- Health check system

## Troubleshooting

### Common Issues

1. **Reader not starting**: Check PLC service configuration
2. **High failure rate**: Verify PLC connection settings
3. **No chamber updates**: Ensure chambers exist and are active
4. **Socket.IO not broadcasting**: Check global.socketHandler availability

### Debugging

Enable debug logging to see detailed operations:

```javascript
// In your environment or code
process.env.LOG_LEVEL = 'debug';
```

This will show individual chamber updates and raw values in the logs.
