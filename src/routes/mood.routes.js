import express from 'express'
import pool from '../db.js'
import { createMoodSchema, listMoodSchema, summarySchema } from '../validators/mood.schema.js'

const router = express.Router()

// POST /mood — create or upsert daily mood
router.post('/', async (req, res, next) => {
  try {
    const { value, error } = createMoodSchema.validate(req.body, { abortEarly: false })
    if (error) {
      return res.status(422).json({ success: false, message: 'Validation error', details: error.details })
    }
    const { user_id, date, mood_score, mood_label = null, notes = null } = value

    const sql = `
      INSERT INTO mood_reports (user_id, date, mood_score, mood_label, notes)
      VALUES (?, DATE(?), ?, ?, ?)
      ON DUPLICATE KEY UPDATE mood_score=VALUES(mood_score), mood_label=VALUES(mood_label), notes=VALUES(notes), updated_at=NOW()
    `
    const [result] = await pool.execute(sql, [user_id, date, mood_score, mood_label, notes])
    return res.status(201).json({ success: true, id: result.insertId || null })
  } catch (err) { next(err) }
})

// GET /mood/:user_id — list history with optional range + pagination
router.get('/:user_id', async (req, res, next) => {
  try {
    const { value, error } = listMoodSchema.validate(req.query, { abortEarly: false })
    if (error) {
      return res.status(422).json({ success: false, message: 'Validation error', details: error.details })
    }
    const userId = req.params.user_id
    const { from = null, to = null, page, per_page } = value
    const offset = (page - 1) * per_page

    const params = [userId]
    let whereDate = ''
    if (from) { whereDate += ' AND date >= DATE(?)'; params.push(from) }
    if (to)   { whereDate += ' AND date <= DATE(?)'; params.push(to) }

    const [rows] = await pool.execute(
      `SELECT id, user_id, date, mood_score, mood_label, notes, created_at, updated_at
       FROM mood_reports
       WHERE user_id = ? ${whereDate}
       ORDER BY date DESC
       LIMIT ? OFFSET ?`,
      [...params, per_page, offset]
    )

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM mood_reports WHERE user_id = ? ${whereDate}`,
      params
    )

    res.json({
      success: true,
      page, per_page,
      total,
      data: rows
    })
  } catch (err) { next(err) }
})

// GET /mood/summary/:user_id?period=week|month
router.get('/summary/:user_id', async (req, res, next) => {
  try {
    const { value, error } = summarySchema.validate(req.query, { abortEarly: false })
    if (error) {
      return res.status(422).json({ success: false, message: 'Validation error', details: error.details })
    }
    const userId = req.params.user_id
    const { period, from = null, to = null } = value

    const params = [userId]
    let whereDate = ''
    if (from) { whereDate += ' AND date >= DATE(?)'; params.push(from) }
    if (to)   { whereDate += ' AND date <= DATE(?)'; params.push(to) }

    let groupExpr, selectPeriod
    if (period === 'month') {
      groupExpr = "DATE_FORMAT(date, '%Y-%m')"
      selectPeriod = "DATE_FORMAT(date, '%Y-%m') AS period"
    } else {
      groupExpr = "CONCAT(YEAR(date), '-W', LPAD(WEEK(date, 3),2,'0'))" // ISO-like week numbering (mode 3)
      selectPeriod = "CONCAT(YEAR(date), '-W', LPAD(WEEK(date, 3),2,'0')) AS period"
    }

    const [rows] = await pool.execute(
      `SELECT ${selectPeriod},
              COUNT(*) AS entries,
              AVG(mood_score) AS avg_mood,
              MIN(mood_score) AS min_mood,
              MAX(mood_score) AS max_mood
       FROM mood_reports
       WHERE user_id = ? ${whereDate}
       GROUP BY ${groupExpr}
       ORDER BY MIN(date) DESC`,
      params
    )

    res.json({ success: true, period, data: rows })
  } catch (err) { next(err) }
})

export default router
