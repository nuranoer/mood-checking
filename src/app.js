import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import { apiKeyGuard } from './middlewares/apiKey.js'
import moodRouter from './routes/mood.routes.js'

const app = express()

// Security & body parsing
app.use(helmet())
app.use(cors({ origin: '*', methods: ['GET','POST'], allowedHeaders: ['Content-Type', 'x-api-key'] }))
app.use(express.json({ limit: '256kb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Basic rate limit (per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // 300 requests per 15 minutes
  standardHeaders: 'draft-7',
  legacyHeaders: false
})
app.use(limiter)

// Healthcheck
app.get('/health', (_req, res) => res.json({ ok: true, service: 'mood-checkin-api', ts: new Date().toISOString() }))

// API key auth for everything below
app.use(apiKeyGuard)

// Routes
app.use('/mood', moodRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

// Centralized error handler
app.use((err, _req, res, _next) => {
  console.error(err)
  const status = err.status || 500
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error'
  })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Mood Check-In API listening on port ${PORT}`)
})
