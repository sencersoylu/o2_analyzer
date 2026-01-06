# Frontend Kalibrasyon API Dokümantasyonu

Bu doküman, O2 Analyzer sisteminin kalibrasyon işlemleri için frontend geliştirme sürecinde kullanılacak API endpoint'lerini detaylandırmaktadır.

## ⚠️ Önemli Route Güncellemesi

Settings API routes artık `/api/settings` altında erişilebilir durumdadır.

## Ana Kalibrasyon Endpoint'i

### 3-Nokta Otomatik Kalibrasyon

**Endpoint:** `POST /api/settings/{chamberId}/calibrate-three-point`

**Açıklama:**
PLC'den okunan son değeri %21 kabul ederek otomatik 3-nokta kalibrasyon gerçekleştirir.

- 0% noktası: 0 (sabit)
- 21% noktası: PLC'den okunan son değer (chamber.lastRawFromPLC)
- 100% noktası: (PLC değeri / 21) \* 100 formülü ile hesaplanır

**URL Parametreleri:**

- `chamberId` (integer): Oda ID'si (1: Main Chamber, 2: Entry Chamber)

**Request Body:**

```json
{
	"calibratedBy": "kullanıcı_adı", // Opsiyonel, varsayılan: "system"
	"notes": "Kalibrasyon notları" // Opsiyonel
}
```

**Response (Başarılı - 200):**

```json
{
	"success": true,
	"data": {
		"chamber": {
			"id": 1,
			"name": "Main Chamber",
			"raw0": 0,
			"raw21": 5000,
			"raw100": "23809.52",
			"calibrationDate": "2025-09-11T10:30:00.000Z"
			// ... diğer chamber alanları
		},
		"calibrationData": {
			"zeroPointRaw": 0,
			"zeroPointCalibrated": 0,
			"midPointRaw": 5000,
			"midPointCalibrated": 21,
			"hundredPointRaw": 23809.52,
			"hundredPointCalibrated": 100
		},
		"coefficients": {
			"slope": 0.0042,
			"offset": 0,
			"zeroPoint": { "raw": 0, "calibrated": 0 },
			"midPoint": { "raw": 5000, "calibrated": 21 },
			"hundredPoint": { "raw": 23809.52, "calibrated": 100 }
		}
	},
	"message": "3-point calibration completed successfully"
}
```

**Response (Hata - 400):**

```json
{
	"success": false,
	"message": "No recent PLC reading available for this chamber. Please ensure PLC is connected and reading data."
}
```

**Response (Hata - 404):**

```json
{
	"success": false,
	"message": "Chamber not found"
}
```

## Destekleyici Endpoint'ler

### 1. Kalibrasyon Durumu Kontrolü

**Endpoint:** `GET /api/settings/{chamberId}/calibration-status`

**Açıklama:** Odanın mevcut kalibrasyon durumunu kontrol eder.

**Response:**

```json
{
	"success": true,
	"data": {
		"hasActiveCalibration": true,
		"lastCalibration": "2025-09-11T10:30:00.000Z",
		"isCalibrationRequired": false,
		"calibrationPoints": {
			"zeroPoint": { "raw": 0, "calibrated": 0 },
			"midPoint": { "raw": 5000, "calibrated": 21 },
			"hundredPoint": { "raw": 23809.52, "calibrated": 100 },
			"coefficients": { "slope": 0.0042, "offset": 0 }
		}
	}
}
```

### 2. Aktif Kalibrasyon Noktalarını Getir

**Endpoint:** `GET /api/settings/{chamberId}/calibration-points`

**Response:**

```json
{
	"success": true,
	"data": {
		"chamberId": 1,
		"zeroPointRaw": 0,
		"zeroPointCalibrated": 0,
		"midPointRaw": 5000,
		"midPointCalibrated": 21,
		"hundredPointRaw": 23809.52,
		"hundredPointCalibrated": 100,
		"calibrationDate": "2025-09-11T10:30:00.000Z",
		"chamber": {
			"id": 1,
			"name": "Main Chamber"
		}
	}
}
```

### 3. Ham Değeri Kalibre Et

**Endpoint:** `POST /api/settings/{chamberId}/calibrate-reading`

**Açıklama:** Verilen ham sensör değerini kalibre edilmiş değere dönüştürür.

**Request Body:**

```json
{
	"rawValue": 4500
}
```

**Response:**

```json
{
	"success": true,
	"data": {
		"rawValue": 4500,
		"calibratedValue": 18.9,
		"chamberId": 1
	}
}
```

### 4. Kalibrasyon Geçmişi

**Endpoint:** `GET /api/settings/{chamberId}/calibration-history?limit=50`

**Query Parametreleri:**

- `limit` (integer): Döndürülecek kayıt sayısı (varsayılan: 50)

**Response:**

```json
{
	"success": true,
	"data": [
		{
			"id": 1,
			"chamberId": 1,
			"calibrationDate": "2025-09-11T10:30:00.000Z",
			"zeroPointRaw": 0,
			"midPointRaw": 5000,
			"hundredPointRaw": 23809.52,
			"chamber": {
				"id": 1,
				"name": "Main Chamber"
			}
		}
	],
	"count": 1
}
```

### 5. Kalibrasyon İstatistikleri

**Endpoint:** `GET /api/settings/calibration/stats?chamberId=1&days=30`

**Query Parametreleri:**

- `chamberId` (integer): Opsiyonel, belirli oda için istatistik
- `days` (integer): Son kaç gün (varsayılan: 30)

**Response:**

```json
{
	"success": true,
	"data": [
		{
			"chamberId": 1,
			"chamber": {
				"id": 1,
				"name": "Main Chamber"
			},
			"totalCalibrations": 1,
			"lastCalibration": "2025-09-11T10:30:00.000Z"
		}
	]
}
```

## PLC Veri Kontrolü

### Oda PLC Verisi Kontrolü

**Endpoint:** `GET /api/chambers/{chamberId}`

**Açıklama:** Kalibrasyon öncesi PLC verilerinin mevcut olup olmadığını kontrol etmek için kullanılır.

**Response:**

```json
{
	"success": true,
	"data": {
		"id": 1,
		"name": "Main Chamber",
		"lastRawFromPLC": 5000, // Kalibrasyon için gerekli
		"lastValue": 20.5,
		"calibrationDate": "2025-09-11T10:30:00.000Z"
		// ... diğer alanlar
	}
}
```

## Frontend İmplementasyon Örneği

### React/JavaScript Örneği

```javascript
// Kalibrasyon durumunu kontrol et
const checkCalibrationStatus = async (chamberId) => {
	try {
		const response = await fetch(
			`/api/settings/${chamberId}/calibration-status`
		);
		const result = await response.json();
		return result;
	} catch (error) {
		console.error('Kalibrasyon durumu kontrol hatası:', error);
		throw error;
	}
};

// 3-nokta kalibrasyon gerçekleştir
const performCalibration = async (chamberId, calibratedBy, notes = '') => {
	try {
		// Önce chamber verisini kontrol et
		const chamberResponse = await fetch(`/api/chambers/${chamberId}`);
		const chamberData = await chamberResponse.json();

		if (!chamberData.success || !chamberData.data.lastRawFromPLC) {
			throw new Error(
				'PLC verisi mevcut değil. Lütfen PLC bağlantısını kontrol edin.'
			);
		}

		// Kalibrasyonu gerçekleştir
		const response = await fetch(
			`/api/settings/${chamberId}/calibrate-three-point`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					calibratedBy,
					notes,
				}),
			}
		);

		const result = await response.json();

		if (!result.success) {
			throw new Error(result.message);
		}

		return result;
	} catch (error) {
		console.error('Kalibrasyon hatası:', error);
		throw error;
	}
};

// Kullanım örneği
const handleCalibration = async () => {
	try {
		setLoading(true);

		const result = await performCalibration(
			selectedChamberId,
			currentUser.name,
			'Otomatik PLC tabanlı kalibrasyon'
		);

		console.log('Kalibrasyon başarılı:', result);

		// UI güncelleme
		showSuccessMessage('Kalibrasyon başarıyla tamamlandı!');
		refreshCalibrationData();
	} catch (error) {
		showErrorMessage(error.message);
	} finally {
		setLoading(false);
	}
};
```

## Önemli Notlar

1. **PLC Bağımlılığı:** Kalibrasyon işlemi PLC'den gelen `lastRawFromPLC` değerine bağımlıdır. Kalibrasyon öncesi bu değerin mevcut olduğundan emin olun.

2. **Otomatik Hesaplama:** Artık manuel nokta girişi yapılmıyor. Sistem otomatik olarak:

   - 0% = 0 (sabit)
   - 21% = PLC'den okunan değer
   - 100% = (PLC değeri / 21) \* 100

3. **Real-time Güncellemeler:** Socket.IO üzerinden gerçek zamanlı kalibrasyon güncellemeleri alınabilir.

4. **Error Handling:** Tüm endpoint'lerde uygun hata yönetimi yapılmalıdır.

5. **Validasyon:** Backend'de kalibrasyon verileri otomatik olarak doğrulanır.

Bu API dokümantasyonu, frontend geliştiricilerinin kalibrasyon özelliklerini entegre etmesi için gerekli tüm bilgileri içermektedir.
