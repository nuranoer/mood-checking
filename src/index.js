import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { migrate } from './db.js';
import { apiKeyAuth } from './middleware/auth.js';
import { router as moodRouter } from './routes/mood.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

if (process.argv.includes('--init-db')) {
  migrate();
  console.log('Database initialized.');
  process.exit(0);
}

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use(apiKeyAuth);
app.use('/', moodRouter);

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

app.listen(PORT, () => {
  console.log(`Mood Check-In API running on http://localhost:${PORT}`);
});
