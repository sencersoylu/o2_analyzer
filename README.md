# O2 Analyzer Backend

Comprehensive backend system for O2 (Oxygen) Analyzer application using Node.js, Express.js, and SQLite database. The system manages oxygen monitoring chambers with real-time readings, alarms, calibration, and settings management.

## Features

- **Chamber Management**: Create, update, and manage oxygen monitoring chambers
- **Real-time O2 Monitoring**: Track oxygen levels with temperature and humidity data
- **Alarm System**: Automatic alarm detection for high/low O2 levels, sensor errors, and calibration due
- **Calibration Management**: Track calibration history and schedule maintenance
- **Real-time Communication**: Socket.IO for live data updates
- **Analytics & Reporting**: Dashboard data, trends, and historical reports
- **Security**: Rate limiting, CORS, input validation, and security headers

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite with Sequelize ORM
- **Real-time Communication**: Socket.IO
- **Validation**: Joi
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate Limiting

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd o2_analyzer
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp env.example .env
```

Edit the `.env` file with your configuration:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=./database.sqlite
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

4. Set up the database:

```bash
# Run migration to create tables
npm run migrate

# Seed the database with sample data
npm run seed
```

5. Start the server:

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### Chamber Management

#### Get All Chambers

```http
GET /api/chambers
```

#### Get Chamber by ID

```http
GET /api/chambers/:id
```

#### Create Chamber

```http
POST /api/chambers
Content-Type: application/json

{
  "name": "New Chamber",
  "description": "Chamber description",
  "isActive": true
}
```

#### Update Chamber

```http
PUT /api/chambers/:id
Content-Type: application/json

{
  "name": "Updated Chamber",
  "description": "Updated description"
}
```

#### Delete Chamber

```http
DELETE /api/chambers/:id
```

### O2 Readings

#### Get Chamber Readings

```http
GET /api/chambers/:id/readings?page=1&limit=50&startDate=2024-01-01&endDate=2024-01-31
```

#### Get Latest Reading

```http
GET /api/chambers/:id/readings/latest
```

#### Add New Reading

```http
POST /api/chambers/:id/readings
Content-Type: application/json

{
  "o2Level": 21.5,
  "temperature": 22.0,
  "humidity": 45.0,
  "sensorStatus": "normal"
}
```

#### Get Historical Data

```http
GET /api/chambers/:id/readings/history?startDate=2024-01-01&endDate=2024-01-31&interval=hour
```

### Settings Management

#### Get Chamber Settings

```http
GET /api/chambers/:id/settings
```

#### Update Chamber Settings

```http
PUT /api/chambers/:id/settings
Content-Type: application/json

{
  "alarmLevelHigh": 24.0,
  "alarmLevelLow": 16.0,
  "calibrationLevel": 21.0,
  "sensorModel": "O2-Sensor-Pro",
  "sensorSerialNumber": "SN001"
}
```

#### Perform Calibration

```http
POST /api/chambers/:id/calibrate
Content-Type: application/json

{
  "calibrationLevel": 21.0,
  "calibratedBy": "operator",
  "notes": "Routine calibration"
}
```

#### Record Sensor Change

```http
POST /api/chambers/:id/sensor-changed
Content-Type: application/json

{
  "sensorModel": "O2-Sensor-Pro",
  "sensorSerialNumber": "SN002"
}
```

### Alarm Management

#### Get Active Alarms

```http
GET /api/alarms
```

#### Get Chamber Alarms

```http
GET /api/alarms/:id?includeResolved=false
```

#### Mute Alarm

```http
POST /api/alarms/:id/mute
Content-Type: application/json

{
  "mutedUntil": "2024-01-15T10:00:00Z"
}
```

#### Resolve Alarm

```http
POST /api/alarms/:id/resolve
```

#### Get Alarm History

```http
GET /api/alarms/history?chamberId=1&alarmType=high_o2&startDate=2024-01-01&endDate=2024-01-31
```

### Analytics & Reports

#### Get Dashboard Data

```http
GET /api/analytics/dashboard?days=7
```

#### Get O2 Trends

```http
GET /api/analytics/trends?chamberId=1&startDate=2024-01-01&endDate=2024-01-31&interval=hour
```

#### Get Calibration Reports

```http
GET /api/analytics/reports/calibration-history?startDate=2024-01-01&endDate=2024-01-31&chamberId=1
```

#### Get Alarm Summary Reports

```http
GET /api/analytics/reports/alarm-summary?startDate=2024-01-01&endDate=2024-01-31&chamberId=1&alarmType=high_o2
```

### Health Check

#### System Health

```http
GET /health
```

## Socket.IO Events

### Client Events

#### Join Chamber Room

```javascript
socket.emit('join-chamber', chamberId);
```

#### Join Global Room

```javascript
socket.emit('join-global');
```

#### Leave Chamber Room

```javascript
socket.emit('leave-chamber', chamberId);
```

#### Ping

```javascript
socket.emit('ping');
```

### Server Events

#### O2 Reading Update

```javascript
socket.on('o2-reading', (data) => {
	console.log('New O2 reading:', data);
	// data: { chamberId, reading, timestamp }
});
```

#### Alarm Triggered

```javascript
socket.on('alarm-triggered', (data) => {
	console.log('Alarm triggered:', data);
	// data: { alarm, timestamp }
});
```

#### Alarm Resolved

```javascript
socket.on('alarm-resolved', (data) => {
	console.log('Alarm resolved:', data);
	// data: { alarm, timestamp }
});
```

#### Calibration Performed

```javascript
socket.on('calibration-performed', (data) => {
	console.log('Calibration performed:', data);
	// data: { chamberId, calibration, timestamp }
});
```

#### Settings Updated

```javascript
socket.on('settings-updated', (data) => {
	console.log('Settings updated:', data);
	// data: { chamberId, settings, timestamp }
});
```

#### System Status

```javascript
socket.on('system-status', (data) => {
	console.log('System status:', data);
	// data: { status, timestamp }
});
```

#### Pong Response

```javascript
socket.on('pong', (data) => {
	console.log('Pong received:', data);
	// data: { timestamp }
});
```

## Database Schema

### Chambers

- `id` (PRIMARY KEY)
- `name` (VARCHAR, UNIQUE)
- `description` (TEXT)
- `isActive` (BOOLEAN)
- `createdAt` (DATETIME)
- `updatedAt` (DATETIME)

### O2Readings

- `id` (PRIMARY KEY)
- `chamberId` (FOREIGN KEY)
- `o2Level` (DECIMAL(5,2))
- `temperature` (DECIMAL(5,2), NULLABLE)
- `humidity` (DECIMAL(5,2), NULLABLE)
- `timestamp` (DATETIME)
- `sensorStatus` (ENUM: 'normal', 'warning', 'error')

### ChamberSettings

- `id` (PRIMARY KEY)
- `chamberId` (FOREIGN KEY, UNIQUE)
- `alarmLevelHigh` (DECIMAL(5,2))
- `alarmLevelLow` (DECIMAL(5,2))
- `calibrationLevel` (DECIMAL(5,2))
- `lastCalibrationDate` (DATETIME, NULLABLE)
- `sensorModel` (VARCHAR, NULLABLE)
- `sensorSerialNumber` (VARCHAR, NULLABLE)
- `lastSensorChange` (DATETIME, NULLABLE)
- `isCalibrationRequired` (BOOLEAN)

### Alarms

- `id` (PRIMARY KEY)
- `chamberId` (FOREIGN KEY)
- `alarmType` (ENUM: 'high_o2', 'low_o2', 'sensor_error', 'calibration_due')
- `isActive` (BOOLEAN)
- `isMuted` (BOOLEAN)
- `mutedUntil` (DATETIME, NULLABLE)
- `triggeredAt` (DATETIME)
- `resolvedAt` (DATETIME, NULLABLE)
- `o2LevelWhenTriggered` (DECIMAL(5,2), NULLABLE)

### CalibrationHistory

- `id` (PRIMARY KEY)
- `chamberId` (FOREIGN KEY)
- `calibrationLevel` (DECIMAL(5,2))
- `previousCalibrationLevel` (DECIMAL(5,2), NULLABLE)
- `calibratedBy` (VARCHAR)
- `calibrationDate` (DATETIME)
- `notes` (TEXT, NULLABLE)

## Development

### Scripts

```bash
# Start development server
npm run dev

# Start production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run database migration
npm run migrate

# Seed database with sample data
npm run seed

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Project Structure

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
├── scripts/                 # Database migration scripts
├── logs/                    # Application logs
├── .env                     # Environment variables
├── package.json
└── README.md
```

## Testing

The application includes comprehensive test coverage for all endpoints and services. Run tests with:

```bash
npm test
```

## Deployment

### Production Setup

1. Set environment variables for production:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=./database.sqlite
CORS_ORIGIN=https://your-frontend-domain.com
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
LOG_LEVEL=error
```

2. Install dependencies:

```bash
npm install --production
```

3. Run database migration:

```bash
npm run migrate
```

4. Start the server:

```bash
npm start
```

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t o2-analyzer-backend .
docker run -p 3001:3001 o2-analyzer-backend
```

## Monitoring

### Health Check

Monitor the application health:

```http
GET /health
```

Response:

```json
{
	"status": "OK",
	"timestamp": "2024-01-15T10:00:00.000Z",
	"uptime": 3600,
	"environment": "production",
	"connectedClients": 5
}
```

### Logs

Application logs are stored in the `logs/` directory:

- `combined.log`: All logs
- `error.log`: Error logs only

## Security

- **Rate Limiting**: API endpoints are rate-limited to prevent abuse
- **CORS**: Configured for frontend communication
- **Input Validation**: All inputs are validated using Joi schemas
- **Security Headers**: Helmet.js provides security headers
- **SQL Injection Protection**: Sequelize ORM prevents SQL injection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests and linting
6. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For support and questions, please open an issue in the repository.
# o2_analyzer
