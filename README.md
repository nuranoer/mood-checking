# Mood Check-In API — Node.js + MySQL

Backend sederhana untuk fitur **Mood Check-In** (case assessment EmergencyyCall) — menyimpan, menampilkan, dan meringkas data mood harian pengguna.

## 🚀 Tech Stack
- **Node.js + Express**
- **MySQL (mysql2/promise)**
- **Joi** untuk validasi
- **Helmet, CORS, Rate Limit** untuk pengamanan dasar
- **Docker-ready** (opsional, tinggal tambah compose)

---

## 1) Arsitektur Singkat & Flow Request–Response

```
Client (Web/Mobile)
    |
    |  HTTPS + x-api-key
    v
[Express API]
  - helmet/cors/morgan/rateLimit
  - apiKeyGuard (x-api-key)
  - routes: /mood, /mood/summary
    |
    v
[MySQL Connection Pool]
  - INSERT/UPSERT mood harian
  - SELECT riwayat & ringkasan (GROUP BY week/month)
```

**Prinsip desain:**
- Stateless API dengan **API Key** sederhana di header `x-api-key`.
- **Idempotent harian**: kombinasi `(user_id, date)` **UNIQUE**, sehingga POST berulang di tanggal yang sama akan **update** (UPSERT).
- **Index** pada `(user_id, date)` untuk query riwayat & ringkasan yang cepat.
- Validasi input ketat sebelum menyentuh DB.

---

## 2) Endpoint & Contoh Payload

### Healthcheck
`GET /health` → `200 OK`
```json
{ "ok": true, "service": "mood-checkin-api", "ts": "2025-10-28T03:00:00.000Z" }
```

> Semua endpoint di bawah ini **wajib** header `x-api-key: <API_KEY>`

### Create/Upsert Daily Mood
`POST /mood`
```json
{
  "user_id": "user_123",
  "date": "2025-10-28",
  "mood_score": 4,
  "mood_label": "calm",
  "notes": "Had a productive day"
}
```
**Responses**
- `201 Created` → `{ "success": true, "id": 123 }`
- `422 Unprocessable Entity` (validasi gagal)
- `401 Unauthorized` (API key salah)

### List User Mood History
`GET /mood/:user_id?from=2025-10-01&to=2025-10-31&page=1&per_page=20`

**Response**
```json
{
  "success": true,
  "page": 1,
  "per_page": 20,
  "total": 31,
  "data": [
    {
      "id": 123,
      "user_id": "user_123",
      "date": "2025-10-28",
      "mood_score": 4,
      "mood_label": "calm",
      "notes": "Had a productive day",
      "created_at": "2025-10-28T03:05:00.000Z",
      "updated_at": "2025-10-28T03:05:00.000Z"
    }
  ]
}
```

### Summary by Week/Month
`GET /mood/summary/:user_id?period=week&from=2025-09-01&to=2025-10-31`

**Response**
```json
{
  "success": true,
  "period": "week",
  "data": [
    { "period": "2025-W43", "entries": 7, "avg_mood": 3.86, "min_mood": 2, "max_mood": 5 },
    { "period": "2025-W42", "entries": 6, "avg_mood": 3.50, "min_mood": 2, "max_mood": 5 }
  ]
}
```

---

## 3) Pertimbangan Keamanan & Skalabilitas

**Keamanan**
- `helmet`, `cors` (allow-list asal domain bisa ditambah), `express-rate-limit` menahan brute force.
- **API Key** pada header `x-api-key`. Untuk produksi sebaiknya migrasi ke **JWT/OAuth**.
- Validasi input dengan **Joi**; limit payload `256kb`.
- Gunakan koneksi DB melalui **connection pool**, kredensial dari `.env`.
- Pisahkan jaringan (VPC), **parameterized query** untuk cegah SQL injection.

**Skalabilitas**
- Index `(user_id, date)` + UNIQUE key memastikan write & read efisien pada 50k entri/hari.
- Endpoint list support **pagination** & **date range** untuk menekan beban.
- **Stateless** → mudah di-scale horizontal di belakang load balancer.
- Rekomendasi lanjut: sharding by user hash, read replica, dan CDC untuk feed ke modul AI.

---

## 4) Alasan Teknis di Balik Keputusan Desain

- **MySQL**: konsisten, mudah dioperasikan, agregasi mingguan/bulanan cukup dengan fungsi built-in.
- **UPSERT (ON DUPLICATE KEY)**: menghindari duplikasi laporan harian dan memudahkan edit.
- **API Key Guard**: sesuai requirement akses terbatas; mudah diintegrasikan front-end.
- **Joi Validation**: deteksi error lebih dini & pesan yang rapi.
- **Connection Pool**: menghemat overhead koneksi, stabil di beban tinggi.
- **Index & UNIQUE**: performa baca/tulis pada dimensi utama (user, tanggal).

---

## 🛠️ Setup & Run

### 1) Buat database & tabel
```sql
-- schema.sql
CREATE DATABASE IF NOT EXISTS mood_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mood_db;

CREATE TABLE IF NOT EXISTS mood_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  mood_score TINYINT UNSIGNED NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
  mood_label VARCHAR(50) NULL,
  notes VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_date (user_id, date),
  KEY idx_user_date (user_id, date),
  KEY idx_date (date)
) ENGINE=InnoDB;
```

### 2) Salin `.env`
```
cp .env.example .env
```

```ini
# .env
PORT=3000
API_KEY=replace-with-strong-random-string

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=mood_db
NODE_ENV=development
```

### 3) Install & Run
```bash
npm install
npm run dev
# or
npm start
```

### 4) Coba dengan curl
```bash
curl -X POST http://localhost:3000/mood   -H "Content-Type: application/json"   -H "x-api-key: YOUR_API_KEY"   -d '{"user_id":"user_123","date":"2025-10-28","mood_score":4,"mood_label":"calm","notes":"good day"}'

curl "http://localhost:3000/mood/user_123?from=2025-10-01&to=2025-10-31&page=1&per_page=10"   -H "x-api-key: YOUR_API_KEY"

curl "http://localhost:3000/mood/summary/user_123?period=month&from=2025-01-01&to=2025-12-31"   -H "x-api-key: YOUR_API_KEY"
```

---

## 📁 Strukur Proyek
```
mood-checkin-api/
  ├─ src/
  │  ├─ app.js
  │  ├─ db.js
  │  ├─ routes/
  │  │  └─ mood.routes.js
  │  ├─ middlewares/
  │  │  └─ apiKey.js
  │  └─ validators/
  │     └─ mood.schema.js
  ├─ schema.sql
  ├─ .env.example
  ├─ package.json
  └─ README.md
```

**Catatan Produksi (opsional):**
- Tambahkan **Dockerfile** + **docker-compose** untuk dev cepat.
- Tambahkan **observability**: log ke ELK/Datadog, metrics ke Prometheus.
- Buat **migrations** (Knex/Prisma) jika diperlukan skema berkembang.

---

Made with ♥️ for the assessment.
