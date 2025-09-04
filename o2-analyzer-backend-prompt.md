# O2 Analyzer Backend Development Prompt

## Project Overview

Create a comprehensive backend system for an O2 (Oxygen) Analyzer application using Node.js, Express.js, and SQLite database. The system manages oxygen monitoring chambers with real-time readings, alarms, calibration, and settings management.

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite with appropriate ORM (Sequelize or Prisma)
- **Real-time Communication**: Socket.IO for live data updates
- **Additional Libraries**:
  - cors (for frontend communication)
  - helmet (security)
  - express-rate-limit (API protection)
  - joi or zod (data validation)

## Database Schema Requirements

### 1. Chambers Table

```sql
- id (PRIMARY KEY, INTEGER, AUTO_INCREMENT)
- name (VARCHAR, UNIQUE) // e.g., 'Main', 'Entry'
- description (TEXT)
- isActive (BOOLEAN, DEFAULT true)
- createdAt (DATETIME)
- updatedAt (DATETIME)
```

### 2. O2Readings Table

```sql
- id (PRIMARY KEY, INTEGER, AUTO_INCREMENT)
- chamberId (FOREIGN KEY -> Chambers.id)
- o2Level (DECIMAL(5,2)) // e.g., 21.25
- temperature (DECIMAL(5,2), NULLABLE) // Optional temperature reading
- humidity (DECIMAL(5,2), NULLABLE) // Optional humidity reading
- timestamp (DATETIME)
- sensorStatus (ENUM: 'normal', 'warning', 'error')
```

### 3. ChamberSettings Table

```sql
- id (PRIMARY KEY, INTEGER, AUTO_INCREMENT)
- chamberId (FOREIGN KEY -> Chambers.id, UNIQUE)
- alarmLevelHigh (DECIMAL(5,2), DEFAULT 24.0)
- alarmLevelLow (DECIMAL(5,2), DEFAULT 16.0)
- calibrationLevel (DECIMAL(5,2), DEFAULT 21.0)
- lastCalibrationDate (DATETIME)
- sensorModel (VARCHAR)
- sensorSerialNumber (VARCHAR)
- lastSensorChange (DATETIME)
- isCalibrationRequired (BOOLEAN, DEFAULT false)
```

### 4. Alarms Table

```sql
- id (PRIMARY KEY, INTEGER, AUTO_INCREMENT)
- chamberId (FOREIGN KEY -> Chambers.id)
- alarmType (ENUM: 'high_o2', 'low_o2', 'sensor_error', 'calibration_due')
- isActive (BOOLEAN, DEFAULT true)
- isMuted (BOOLEAN, DEFAULT false)
- mutedUntil (DATETIME, NULLABLE)
- triggeredAt (DATETIME)
- resolvedAt (DATETIME, NULLABLE)
- o2LevelWhenTriggered (DECIMAL(5,2))
```

### 5. CalibrationHistory Table

```sql
- id (PRIMARY KEY, INTEGER, AUTO_INCREMENT)
- chamberId (FOREIGN KEY -> Chambers.id)
- calibrationLevel (DECIMAL(5,2))
- previousCalibrationLevel (DECIMAL(5,2))
- calibratedBy (VARCHAR) // System or operator identifier
- calibrationDate (DATETIME)
- notes (TEXT, NULLABLE)
```

## API Endpoints Requirements

### Chamber Management

- `GET /api/chambers` - Get all chambers with current readings
- `GET /api/chambers/:id` - Get specific chamber details
- `POST /api/chambers` - Create new chamber
- `PUT /api/chambers/:id` - Update chamber details
- `DELETE /api/chambers/:id` - Delete chamber

### O2 Readings

- `GET /api/chambers/:id/readings` - Get chamber readings with pagination
- `GET /api/chambers/:id/readings/latest` - Get latest reading for chamber
- `POST /api/chambers/:id/readings` - Add new reading (for sensor data input)
- `GET /api/chambers/:id/readings/history` - Get historical data with date range

### Settings Management

- `GET /api/chambers/:id/settings` - Get chamber settings
- `PUT /api/chambers/:id/settings` - Update chamber settings
- `POST /api/chambers/:id/calibrate` - Perform calibration
- `POST /api/chambers/:id/sensor-changed` - Record sensor change

### Alarm Management

- `GET /api/alarms` - Get all active alarms
- `GET /api/chambers/:id/alarms` - Get chamber-specific alarms
- `POST /api/alarms/:id/mute` - Mute alarm for specified duration
- `POST /api/alarms/:id/resolve` - Resolve/acknowledge alarm
- `GET /api/alarms/history` - Get alarm history with filters

### Analytics & Reports

- `GET /api/analytics/dashboard` - Dashboard summary data
- `GET /api/analytics/trends` - O2 level trends over time
- `GET /api/reports/calibration-history` - Calibration reports
- `GET /api/reports/alarm-summary` - Alarm summary reports

## Core Features Implementation

### 1. Real-time Data Broadcasting

- Implement Socket.IO for real-time O2 level updates
- Broadcast alarm status changes to connected clients
- Push notifications for critical alarms
- Connection management for multiple clients

### 2. Alarm System

- Automatic alarm detection based on O2 levels
- Different alarm types (high O2, low O2, sensor errors)
- Alarm muting functionality with auto-unmute
- Alarm escalation based on duration
- Email/SMS notifications (configurable)

### 3. Calibration Management

- Calibration scheduling and reminders
- Historical calibration tracking
- Calibration validation logic
- Auto-calibration failure detection

### 4. Data Validation & Error Handling

- Comprehensive input validation for all endpoints
- Proper error responses with meaningful messages
- Database transaction management
- Graceful handling of sensor communication errors

### 5. Security Features

- Rate limiting on API endpoints
- CORS configuration for frontend
- Input sanitization to prevent injection attacks
- Basic HTTP security headers

### 6. Configuration Management

- Environment-based configuration
- Database connection pooling
- Logging configuration (winston or similar)
- Health check endpoints

## Advanced Features

### 1. Data Analytics

- Statistical analysis of O2 trends
- Predictive maintenance for sensors
- Performance metrics calculation
- Data export functionality (CSV, Excel)

### 2. Backup & Recovery

- Automated database backups
- Data retention policies
- Recovery procedures documentation

### 3. Integration Capabilities

- REST API for third-party integrations
- Webhook support for external notifications
- MQTT support for IoT sensors (optional)

### 4. Performance Optimization

- Database indexing strategy
- Query optimization
- Caching implementation (Redis optional)
- Connection pooling

## Project Structure

```
backend/
├── src/
│   ├── controllers/          # Route handlers
│   ├── models/              # Database models
│   ├── middleware/          # Validation, security
│   ├── routes/              # API routes
│   ├── services/            # Business logic
│   ├── utils/               # Helper functions
│   ├── config/              # Configuration files
│   └── sockets/             # Socket.IO handlers
├── tests/                   # Unit and integration tests
├── docs/                    # API documentation
├── scripts/                 # Database migration scripts
├── .env                     # Environment variables
├── package.json
└── README.md
```

## Environment Variables

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=./database.sqlite
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

## Testing Requirements

- Unit tests for all services and utilities
- Integration tests for API endpoints
- Database transaction testing
- Socket.IO connection testing

## Documentation Requirements

- Complete API documentation (Swagger/OpenAPI)
- Database schema documentation
- Deployment instructions
- Configuration guide
- Troubleshooting guide

## Deployment Considerations

- Docker containerization
- Environment-specific configurations
- Health check endpoints
- Monitoring and logging setup
- Database migration strategy

## Success Criteria

1. All API endpoints function correctly with proper error handling
2. Real-time data updates work seamlessly with frontend
3. Database operations are optimized and reliable
4. Alarm system triggers and resolves correctly
5. System can handle concurrent users and high data volume
6. Complete test coverage (>80%)
7. Comprehensive documentation

This backend should provide a robust, scalable, and maintainable foundation for the O2 Analyzer application with simplified access control.
