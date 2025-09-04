# O2 Analyzer - Frontend Backend Entegrasyonu

## Proje Genel Bakış

Bu proje, O2 (oksijen) analizörü için kapsamlı bir backend API sistemi içermektedir. Backend Node.js, Express.js ve SQLite kullanılarak geliştirilmiştir. Sistemde **2 sabit kabin** bulunmaktadır: **Main** ve **Entry**.

### Önemli Notlar:

- **Sadece 2 kabin**: Main ve Entry (kabin ekleme/silme yok)
- **3 noktalı kalibrasyon**: 0%, orta nokta (genellikle 21%), 100%
- **Decimal sensör verileri**: Ham değerler decimal olarak okunur ve kalibre edilir
- **O2 Sensör aralığı**: 0-100% arasında çalışır

## Backend API Endpoint'leri

### Base URL

```
http://localhost:3001
```

### Ana Endpoint'ler

#### 1. Chamber (Oda) Yönetimi

```
GET    /api/chambers                      - Tüm odaları listele (Main ve Entry)
GET    /api/chambers/:id                  - Belirli bir odayı getir
PUT    /api/chambers/:id                  - Oda verilerini güncelle
POST   /api/chambers                      - Yeni oda oluştur (genellikle sadece test için)
DELETE /api/chambers/:id                  - Oda sil (genellikle sadece test için)

GET    /api/chambers/:id/readings         - Oda okumalarını getir
GET    /api/chambers/:id/readings/latest  - En son okumayı getir
POST   /api/chambers/:id/readings         - Yeni okuma ekle (otomatik kalibrasyon)
GET    /api/chambers/:id/readings/history - Geçmiş verileri getir
```

#### 2. Ayarlar ve Kalibrasyon Yönetimi

```
GET    /api/settings/:id                              - Oda ayarlarını getir
PUT    /api/settings/:id                              - Oda ayarlarını güncelle

POST   /api/settings/:id/calibrate-three-point       - 3 noktalı kalibrasyon yap
GET    /api/settings/:id/calibration-points          - Aktif kalibrasyon noktalarını getir
POST   /api/settings/:id/calibrate-reading           - Ham değeri kalibre et
POST   /api/settings/:id/calibrate                   - Tek nokta kalibrasyon (legacy)

GET    /api/settings/:id/calibration-history         - Kalibrasyon geçmişini getir
GET    /api/settings/:id/calibration-status          - Kalibrasyon durumunu kontrol et
POST   /api/settings/:id/calibration-required        - Kalibrasyon gerekli işaretle
POST   /api/settings/:id/sensor-changed              - Sensör değişikliğini kaydet
GET    /api/settings/calibration/stats               - Kalibrasyon istatistiklerini getir
```

#### 3. Alarm Yönetimi

```
GET    /api/alarms                        - Aktif alarmları listele
GET    /api/alarms/history                - Alarm geçmişini getir
GET    /api/alarms/stats                  - Alarm istatistiklerini getir
GET    /api/alarms/:id                    - Belirli odanın alarmlarını getir
POST   /api/alarms/:id/mute               - Alarmı sustur
POST   /api/alarms/:id/resolve            - Alarmı çöz
```

#### 4. Analitik ve Raporlar

```
GET    /api/analytics/dashboard                      - Dashboard verilerini getir
GET    /api/analytics/trends                         - O2 trendlerini getir
GET    /api/analytics/reports/calibration-history   - Kalibrasyon raporları
GET    /api/analytics/reports/alarm-summary         - Alarm özet raporları
```

#### 6. Sistem Endpoint'leri

```
GET    /health                          - Sistem sağlık kontrolü
GET    /                                - API bilgileri
```

## Veri Modelleri

### Chamber (Oda)

```javascript
{
  id: number,
  name: string,               // "Main" veya "Entry"
  description: string,        // Oda açıklaması
  lastValue: number,          // Son okunan O2 değeri (DECIMAL 5,2)

  // Kalibrasyon verileri (Chamber modeli içinde)
  raw0: number,              // 0% kalibrasyon için ham değer (INTEGER)
  raw21: number,             // 21% kalibrasyon için ham değer (INTEGER)
  raw100: string,            // 100% kalibrasyon için ham değer (TEXT)
  calibrationDate: Date,     // Son kalibrasyon tarihi

  // Alarm seviyeleri
  alarmLevelHigh: number,    // Yüksek alarm seviyesi (DECIMAL 5,2, default: 24.0)
  alarmLevelLow: number,     // Düşük alarm seviyesi (DECIMAL 5,2, default: 16.0)

  lastSensorChange: Date,    // Son sensör değişim tarihi
  isActive: boolean,         // Oda aktif mi? (default: true)
  createdAt: Date,
  updatedAt: Date
}
```

### O2Reading (O2 Okuması)

```javascript
{
  id: number,
  chamberId: number,         // Oda ID (Foreign Key)
  o2Level: number,          // Kalibre edilmiş O2 seviyesi (DECIMAL 5,2, 0-100%)
  temperature: number,      // Sıcaklık (DECIMAL 5,2, -50 ile 100°C arası, nullable)
  humidity: number,         // Nem (DECIMAL 5,2, 0-100%, nullable)
  timestamp: Date,          // Okuma zamanı (default: NOW)
  sensorStatus: string,     // 'normal', 'warning', 'error' (ENUM)
  createdAt: Date,
  updatedAt: Date
}
```

### Alarm

```javascript
{
  id: number,
  chamberId: number,            // Oda ID (Foreign Key)
  alarmType: string,           // 'high_o2', 'low_o2', 'sensor_error', 'calibration_due' (ENUM)
  isActive: boolean,           // Alarm aktif mi? (default: true)
  isMuted: boolean,            // Alarm susturuldu mu? (default: false)
  mutedUntil: Date,           // Susturma bitiş zamanı (nullable)
  triggeredAt: Date,          // Alarm tetiklenme zamanı (default: NOW)
  resolvedAt: Date,           // Alarm çözülme zamanı (nullable)
  o2LevelWhenTriggered: number, // Alarm tetiklendiğindeki O2 seviyesi (DECIMAL 5,2, nullable)
  createdAt: Date,
  updatedAt: Date
}
```

### Kalibrasyon Sistemi

**Not**: Backend sisteminde ayrı CalibrationPoints tablosu yerine, kalibrasyon verileri doğrudan Chamber modeli içinde saklanmaktadır:

- `raw0`: 0% nokta için ham sensör değeri
- `raw21`: 21% nokta için ham sensör değeri
- `raw100`: 100% nokta için ham sensör değeri
- `calibrationDate`: Son kalibrasyon tarihi

Kalibrasyon hesaplamaları backend'de `CalibrationService` tarafından bu veriler kullanılarak yapılır.

## 3 Noktalı Kalibrasyon Sistemi

### Veri Saklama

Backend sisteminde kalibrasyon verileri **Chamber** modeli içinde saklanır:

- `raw0`: 0% noktası için ham sensör değeri (INTEGER)
- `raw21`: 21% noktası için ham sensör değeri (INTEGER)
- `raw100`: 100% noktası için ham sensör değeri (TEXT/STRING)
- `calibrationDate`: Son kalibrasyon tarihi

### Kalibrasyon Formülü

```
3 nokta:
- 0% noktası: (raw0, 0)
- Orta nokta: (raw21, 21.0) - genellikle 21% referans değeri
- 100% noktası: (raw100, 100)
```

### Kalibrasyon Hesaplama (Backend CalibrationService)

```javascript
// 3 noktalı kalibrasyon hesaplama
calculateCalibrationCoefficients(
	zeroPointRaw,       // raw0 değeri
	midPointRaw,        // raw21 değeri
	hundredPointRaw,    // raw100 değeri
	midPointCalibrated = 21.0  // Orta nokta kalibre değeri
) {
	// İki doğru parçası için eğim hesaplama
	// 1. Doğru: 0% -> Orta nokta
	const slope1 = (midPointCalibrated - 0) / (midPointRaw - zeroPointRaw);

	// 2. Doğru: Orta nokta -> 100%
	const slope2 = (100 - midPointCalibrated) / (hundredPointRaw - midPointRaw);

	// Ortalama eğim (basit yaklaşım)
	const avgSlope = (slope1 + slope2) / 2;

	// Offset hesaplama (0% noktasından)
	const offset = 0 - avgSlope * zeroPointRaw;

	return {
		slope: parseFloat(avgSlope.toFixed(6)),
		offset: parseFloat(offset.toFixed(6)),
		zeroPoint: { raw: zeroPointRaw, calibrated: 0 },
		midPoint: { raw: midPointRaw, calibrated: midPointCalibrated },
		hundredPoint: { raw: hundredPointRaw, calibrated: 100 }
	};
}

// Ham değeri kalibre et
applyCalibration(rawValue, slope, offset) {
	const calibratedValue = rawValue * slope + offset;
	return Math.max(0, Math.min(100, calibratedValue)); // 0-100 arasında sınırla
}
```

### API Kullanımı

3 noktalı kalibrasyon için endpoint:

```
POST /api/settings/:id/calibrate-three-point
```

Gönderilecek veri:

```javascript
{
  zeroPointRaw: 0.1234,        // 0% için okunan ham değer
  midPointRaw: 2.5678,         // Orta nokta için okunan ham değer
  hundredPointRaw: 12.3456,    // 100% için okunan ham değer
  midPointCalibrated: 21.0,    // Orta nokta kalibre değeri (varsayılan 21%)
  calibratedBy: "operator",    // Kalibrasyonu yapan kişi
  notes: "Kalibrasyon notları" // İsteğe bağlı notlar
}
```

## Frontend Entegrasyonu İçin Örnekler

### 1. Axios ile API Çağrıları

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

// API instance oluştur
const api = axios.create({
	baseURL: API_BASE_URL,
	timeout: 10000,
	headers: {
		'Content-Type': 'application/json',
	},
});

// Tüm odaları getir (Main ve Entry)
const getChambers = async () => {
	try {
		const response = await api.get('/chambers');
		return response.data;
	} catch (error) {
		console.error('Odalar getirilemedi:', error);
		throw error;
	}
};

// 3 noktalı kalibrasyon yap
const performThreePointCalibration = async (chamberId, calibrationData) => {
	try {
		const response = await api.post(
			`/settings/${chamberId}/calibrate-three-point`,
			{
				zeroPointRaw: calibrationData.zeroPointRaw,
				midPointRaw: calibrationData.midPointRaw,
				hundredPointRaw: calibrationData.hundredPointRaw,
				midPointCalibrated: calibrationData.midPointCalibrated || 21.0,
				calibratedBy: calibrationData.calibratedBy || 'operator',
				notes: calibrationData.notes || '',
			}
		);
		return response.data;
	} catch (error) {
		console.error('Kalibrasyon yapılamadı:', error);
		throw error;
	}
};

// Ham değeri kalibre et
const calibrateReading = async (chamberId, rawValue) => {
	try {
		const response = await api.post(
			`/settings/${chamberId}/calibrate-reading`,
			{
				rawValue: rawValue,
			}
		);
		return response.data;
	} catch (error) {
		console.error('Okuma kalibre edilemedi:', error);
		throw error;
	}
};

// Aktif kalibrasyon noktalarını getir (Chamber verilerinden)
const getActiveCalibrationPoints = async (chamberId) => {
	try {
		const response = await api.get(`/settings/${chamberId}/calibration-points`);
		return response.data;
	} catch (error) {
		console.error('Kalibrasyon noktaları getirilemedi:', error);
		throw error;
	}
};

// Oda ayarlarını getir
const getChamberSettings = async (chamberId) => {
	try {
		const response = await api.get(`/settings/${chamberId}`);
		return response.data;
	} catch (error) {
		console.error('Oda ayarları getirilemedi:', error);
		throw error;
	}
};

// Yeni okuma ekle (otomatik kalibrasyon)
const addReading = async (chamberId, readingData) => {
	try {
		const response = await api.post(`/chambers/${chamberId}/readings`, {
			o2Level: readingData.o2Level, // Ham değer
			temperature: readingData.temperature,
			humidity: readingData.humidity,
			sensorStatus: readingData.sensorStatus || 'normal',
		});
		return response.data;
	} catch (error) {
		console.error('Okuma eklenemedi:', error);
		throw error;
	}
};
```

### 2. React Hook Örneği

```javascript
import { useState, useEffect } from 'react';
import { getChambers, getActiveCalibrationPoints } from './api';

const useChambers = () => {
	const [chambers, setChambers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchChambers = async () => {
			try {
				setLoading(true);
				const data = await getChambers();
				setChambers(data.data); // Main ve Entry odaları
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		fetchChambers();
	}, []);

	return { chambers, loading, error };
};

const useCalibrationPoints = (chamberId) => {
	const [calibrationData, setCalibrationData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		if (!chamberId) return;

		const fetchCalibrationData = async () => {
			try {
				setLoading(true);
				// Kalibrasyon verileri Chamber modelinden geliyor
				const chamberData = await api.get(`/chambers/${chamberId}`);
				const chamber = chamberData.data.data;

				// Chamber'dan kalibrasyon verilerini çıkar
				const calibrationInfo = {
					raw0: chamber.raw0,
					raw21: chamber.raw21,
					raw100: chamber.raw100,
					calibrationDate: chamber.calibrationDate,
					isCalibrated: !!(chamber.raw0 && chamber.raw21 && chamber.raw100),
				};

				setCalibrationData(calibrationInfo);
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		fetchCalibrationData();
	}, [chamberId]);

	return { calibrationData, loading, error };
};
```

### 3. 3 Noktalı Kalibrasyon Komponenti

```javascript
import React, { useState } from 'react';
import { performThreePointCalibration } from './api';

const ThreePointCalibration = ({ chamberId, onCalibrationComplete }) => {
	const [calibrationData, setCalibrationData] = useState({
		zeroPointRaw: '',
		midPointRaw: '',
		hundredPointRaw: '',
		midPointCalibrated: 21.0,
		calibratedBy: '',
		notes: '',
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			const result = await performThreePointCalibration(
				chamberId,
				calibrationData
			);
			console.log('Kalibrasyon tamamlandı:', result);
			onCalibrationComplete && onCalibrationComplete(result);

			// Formu temizle
			setCalibrationData({
				zeroPointRaw: '',
				midPointRaw: '',
				hundredPointRaw: '',
				midPointCalibrated: 21.0,
				calibratedBy: '',
				notes: '',
			});
		} catch (err) {
			setError(err.response?.data?.message || 'Kalibrasyon hatası');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="calibration-form">
			<h3>3 Noktalı Kalibrasyon</h3>

			{error && <div className="error">{error}</div>}

			<form onSubmit={handleSubmit}>
				<div className="form-group">
					<label>0% Noktası (Ham Değer):</label>
					<input
						type="number"
						step="0.0001"
						value={calibrationData.zeroPointRaw}
						onChange={(e) =>
							setCalibrationData({
								...calibrationData,
								zeroPointRaw: parseFloat(e.target.value),
							})
						}
						required
					/>
				</div>

				<div className="form-group">
					<label>Orta Nokta (Ham Değer):</label>
					<input
						type="number"
						step="0.0001"
						value={calibrationData.midPointRaw}
						onChange={(e) =>
							setCalibrationData({
								...calibrationData,
								midPointRaw: parseFloat(e.target.value),
							})
						}
						required
					/>
				</div>

				<div className="form-group">
					<label>Orta Nokta (Kalibre Edilmiş Değer):</label>
					<input
						type="number"
						step="0.1"
						value={calibrationData.midPointCalibrated}
						onChange={(e) =>
							setCalibrationData({
								...calibrationData,
								midPointCalibrated: parseFloat(e.target.value),
							})
						}
						required
					/>
				</div>

				<div className="form-group">
					<label>100% Noktası (Ham Değer):</label>
					<input
						type="number"
						step="0.0001"
						value={calibrationData.hundredPointRaw}
						onChange={(e) =>
							setCalibrationData({
								...calibrationData,
								hundredPointRaw: parseFloat(e.target.value),
							})
						}
						required
					/>
				</div>

				<div className="form-group">
					<label>Kalibrasyonu Yapan:</label>
					<input
						type="text"
						value={calibrationData.calibratedBy}
						onChange={(e) =>
							setCalibrationData({
								...calibrationData,
								calibratedBy: e.target.value,
							})
						}
					/>
				</div>

				<div className="form-group">
					<label>Notlar:</label>
					<textarea
						value={calibrationData.notes}
						onChange={(e) =>
							setCalibrationData({
								...calibrationData,
								notes: e.target.value,
							})
						}
					/>
				</div>

				<button type="submit" disabled={loading}>
					{loading ? 'Kalibrasyon Yapılıyor...' : 'Kalibrasyon Yap'}
				</button>
			</form>
		</div>
	);
};

export default ThreePointCalibration;
```

### 4. Real-time Socket.IO Bağlantısı

```javascript
import io from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

class SocketService {
	constructor() {
		this.socket = null;
		this.isConnected = false;
	}

	connect() {
		this.socket = io(SOCKET_URL, {
			transports: ['websocket', 'polling'],
			timeout: 20000,
		});

		this.socket.on('connect', () => {
			console.log('Socket.IO bağlantısı kuruldu');
			this.isConnected = true;
		});

		this.socket.on('disconnect', () => {
			console.log('Socket.IO bağlantısı kesildi');
			this.isConnected = false;
		});

		this.socket.on('error', (error) => {
			console.error('Socket.IO hatası:', error);
		});

		return this.socket;
	}

	// Yeni O2 okuması dinle (kalibre edilmiş)
	onNewReading(callback) {
		if (this.socket) {
			this.socket.on('new_reading', callback);
		}
	}

	// Yeni alarm dinle
	onNewAlarm(callback) {
		if (this.socket) {
			this.socket.on('new_alarm', callback);
		}
	}

	// Kalibrasyon güncellemesi dinle
	onCalibrationUpdate(callback) {
		if (this.socket) {
			this.socket.on('calibration_update', callback);
		}
	}

	disconnect() {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
			this.isConnected = false;
		}
	}
}

// Kullanım örneği
const socketService = new SocketService();
const socket = socketService.connect();

socketService.onNewReading((reading) => {
	console.log('Yeni O2 okuması:', reading);
	// reading.o2Level - kalibre edilmiş değer
	// reading.rawO2Level - ham değer (varsa)
});

socketService.onCalibrationUpdate((calibration) => {
	console.log('Kalibrasyon güncellendi:', calibration);
	// UI'ı güncelle
});
```

### 5. React Context ile Global State Yönetimi

```javascript
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { getChambers, getActiveCalibrationPoints } from './api';
import { socketService } from './socketService';

const AppContext = createContext();

const initialState = {
	chambers: [],
	calibrationPoints: {},
	readings: {},
	alarms: [],
	loading: false,
	error: null,
};

const appReducer = (state, action) => {
	switch (action.type) {
		case 'SET_LOADING':
			return { ...state, loading: action.payload };
		case 'SET_ERROR':
			return { ...state, error: action.payload };
		case 'SET_CHAMBERS':
			return { ...state, chambers: action.payload };
		case 'SET_CALIBRATION_POINTS':
			return {
				...state,
				calibrationPoints: {
					...state.calibrationPoints,
					[action.payload.chamberId]: action.payload.points,
				},
			};
		case 'ADD_READING':
			return {
				...state,
				readings: {
					...state.readings,
					[action.payload.chamberId]: [
						...(state.readings[action.payload.chamberId] || []),
						action.payload.reading,
					],
				},
			};
		case 'ADD_ALARM':
			return {
				...state,
				alarms: [action.payload, ...state.alarms],
			};
		default:
			return state;
	}
};

export const AppProvider = ({ children }) => {
	const [state, dispatch] = useReducer(appReducer, initialState);

	useEffect(() => {
		const initializeData = async () => {
			try {
				dispatch({ type: 'SET_LOADING', payload: true });

				// Odaları getir
				const chambersResponse = await getChambers();
				const chambers = chambersResponse.data;
				dispatch({ type: 'SET_CHAMBERS', payload: chambers });

				// Her oda için kalibrasyon noktalarını getir
				for (const chamber of chambers) {
					try {
						const calibrationResponse = await getActiveCalibrationPoints(
							chamber.id
						);
						dispatch({
							type: 'SET_CALIBRATION_POINTS',
							payload: {
								chamberId: chamber.id,
								points: calibrationResponse.data,
							},
						});
					} catch (error) {
						console.warn(
							`Kalibrasyon noktaları getirilemedi (Chamber ${chamber.id}):`,
							error
						);
					}
				}
			} catch (error) {
				dispatch({ type: 'SET_ERROR', payload: error.message });
			} finally {
				dispatch({ type: 'SET_LOADING', payload: false });
			}
		};

		initializeData();
	}, []);

	useEffect(() => {
		// Socket.IO event listeners
		socketService.onNewReading((reading) => {
			dispatch({ type: 'ADD_READING', payload: reading });
		});

		socketService.onCalibrationUpdate((calibration) => {
			dispatch({
				type: 'SET_CALIBRATION_POINTS',
				payload: {
					chamberId: calibration.chamberId,
					points: calibration.points,
				},
			});
		});

		return () => {
			socketService.disconnect();
		};
	}, []);

	return (
		<AppContext.Provider value={{ state, dispatch }}>
			{children}
		</AppContext.Provider>
	);
};

export const useApp = () => {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error('useApp must be used within an AppProvider');
	}
	return context;
};
```

## Hata Yönetimi

### API Hata Kodları

- `400` - Bad Request (Geçersiz veri)
- `403` - Forbidden (Kabin ekleme/silme yasak)
- `404` - Not Found (Kaynak bulunamadı)
- `422` - Unprocessable Entity (Validasyon hatası)
- `500` - Internal Server Error (Sunucu hatası)

### Hata Yakalama Örneği

```javascript
const handleApiError = (error) => {
	if (error.response) {
		const { status, data } = error.response;

		switch (status) {
			case 400:
				return `Geçersiz veri: ${data.message}`;
			case 403:
				return 'Bu işlem yasak: ' + data.message;
			case 404:
				return 'Kaynak bulunamadı';
			case 422:
				return `Validasyon hatası: ${data.message}`;
			case 500:
				return 'Sunucu hatası oluştu';
			default:
				return `Beklenmeyen hata: ${status}`;
		}
	} else if (error.request) {
		return 'Sunucuya bağlanılamıyor';
	} else {
		return 'İstek oluşturulamadı';
	}
};
```

## Güvenlik

### CORS Ayarları

Backend CORS ayarları `http://localhost:3000` için yapılandırılmıştır.

### Rate Limiting

API'de rate limiting aktif.

## Performans İpuçları

1. **Kalibrasyon Cache**: Kalibrasyon noktalarını cache'leyin
2. **Real-time Updates**: Socket.IO ile gerçek zamanlı güncellemeler
3. **Optimistic Updates**: UI'da anında güncelleme yapın
4. **Error Boundaries**: React error boundary'leri kullanın

## Test Etme

### Backend'i Başlatma

```bash
cd o2_analyzer
npm install
npm run seed  # Veritabanını seed et
npm run dev
```

### API Test Etme

```bash
# Health check
curl http://localhost:3001/health

# Odaları listele (Main ve Entry)
curl http://localhost:3001/api/chambers

# Oda ayarlarını getir
curl http://localhost:3001/api/settings/1

# 3 noktalı kalibrasyon yap
curl -X POST http://localhost:3001/api/settings/1/calibrate-three-point \
  -H "Content-Type: application/json" \
  -d '{
    "zeroPointRaw": 0.1234,
    "midPointRaw": 2.5678,
    "hundredPointRaw": 12.3456,
    "midPointCalibrated": 21.0,
    "calibratedBy": "operator",
    "notes": "Test kalibrasyonu"
  }'

# Ham değeri kalibre et
curl -X POST http://localhost:3001/api/settings/1/calibrate-reading \
  -H "Content-Type: application/json" \
  -d '{"rawValue": 5.6789}'

# Yeni O2 okuması ekle
curl -X POST http://localhost:3001/api/chambers/1/readings \
  -H "Content-Type: application/json" \
  -d '{
    "o2Level": 20.5,
    "temperature": 22.3,
    "humidity": 45.2,
    "sensorStatus": "normal"
  }'
```

## Örnek Frontend Projesi Yapısı

```
frontend/
├── src/
│   ├── api/
│   │   ├── index.js              # API client (axios instance)
│   │   ├── chambers.js           # Chamber API calls
│   │   ├── settings.js           # Settings & Calibration API calls
│   │   ├── alarms.js             # Alarm API calls
│   │   └── analytics.js          # Analytics API calls
│   ├── hooks/
│   │   ├── useChambers.js        # Chamber data management
│   │   ├── useCalibration.js     # Calibration data from Chamber model
│   │   ├── useSettings.js        # Chamber settings management
│   │   ├── useAlarms.js          # Alarm management
│   │   └── useSocket.js          # Socket.IO real-time updates
│   ├── context/
│   │   └── AppContext.js         # Global state management
│   ├── components/
│   │   ├── ChamberList.js        # Main ve Entry chamber listesi
│   │   ├── ChamberCard.js        # Tek chamber görünümü
│   │   ├── ThreePointCalibration.js # 3 noktalı kalibrasyon formu
│   │   ├── CalibrationStatus.js  # Kalibrasyon durumu gösterimi
│   │   ├── O2ReadingChart.js     # O2 seviye grafikleri
│   │   ├── AlarmPanel.js         # Alarm listesi ve yönetimi
│   │   ├── SettingsForm.js       # Chamber ayarları formu
│   │   └── Dashboard.js          # Ana dashboard
│   ├── services/
│   │   └── socketService.js      # Socket.IO client service
│   └── utils/
│       ├── errorHandler.js       # API hata yönetimi
│       ├── calibrationUtils.js   # Frontend kalibrasyon yardımcıları
│       ├── formatters.js         # Veri format yardımcıları
│       └── constants.js          # Sabitler (alarm seviyeleri vs.)
├── package.json
└── README.md
```

Bu prompt, O2 Analyzer backend API'si ile frontend entegrasyonu için gerekli tüm bilgileri içermektedir. 3 noktalı kalibrasyon sistemi ve sabit 2 kabin yapısına özel olarak hazırlanmıştır.
