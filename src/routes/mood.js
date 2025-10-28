import express from 'express';
import { db } from '../db.js';
import { moodSchema, validate } from '../validation.js';

export const router = express.Router();

// POST /mood — create or upsert mood entry
router.post('/mood', validate(moodSchema), (req, res) => {
  const { user_id, date, mood_score, mood_label, notes } = req.validated;

  // ensure user exists
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(user_id);

  // upsert
  const stmt = db.prepare(`
    INSERT INTO mood_logs (user_id, date, mood_score, mood_label, notes)
    VALUES (@user_id, @date, @mood_score, @mood_label, @notes)
    ON CONFLICT(user_id, date) DO UPDATE SET
      mood_score=excluded.mood_score,
      mood_label=excluded.mood_label,
      notes=excluded.notes,
      updated_at=datetime('now')
  `);

  const info = stmt.run({ user_id, date, mood_score, mood_label, notes });
  return res.status(201).json({ success: true, upserted: info.changes > 0 });
});

// GET /mood/:user_id — list mood history (supports pagination & date range)
router.get('/mood/:user_id', (req, res) => {
  const { user_id } = req.params;
  const { start_date, end_date, limit = 100, offset = 0, order = 'desc' } = req.query;

  const lim = Math.min(parseInt(limit || 100, 10), 500);
  const off = parseInt(offset || 0, 10);
  const ord = (order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const params = [user_id];
  let where = 'WHERE user_id = ?';

  if (start_date) { where += ' AND date >= ?'; params.push(String(start_date)); }
  if (end_date) { where += ' AND date <= ?'; params.push(String(end_date)); }

  const rows = db.prepare(`
    SELECT user_id, date, mood_score, mood_label, notes, created_at, updated_at
    FROM mood_logs
    ${where}
    ORDER BY date ${ord}
    LIMIT ? OFFSET ?
  `).all(...params, lim, off);

  const total = db.prepare(`SELECT COUNT(*) as c FROM mood_logs ${where}`).get(...params).c;

  return res.json({ success: true, total, rows });
});

// GET /summary/:user_id — average mood per week or month
router.get('/summary/:user_id', (req, res) => {
  const { user_id } = req.params;
  const { period = 'month' } = req.query;

  if (!['week', 'month'].includes(String(period))) {
    return res.status(400).json({ error: "period must be 'week' or 'month'" });
  }

  let groupExpr, labelExpr;
  if (period === 'week') {
    // Approximate ISO week grouping for SQLite
    groupExpr = "strftime('%Y', date) || '-W' || printf('%02d', (cast(strftime('%j', date) as int) - 1) / 7 + 1)";
    labelExpr = groupExpr + " AS period";
  } else {
    groupExpr = "strftime('%Y-%m', date)";
    labelExpr = groupExpr + " AS period";
  }

  const sql = `
    SELECT ${labelExpr},
           COUNT(*)     AS entries,
           ROUND(AVG(mood_score), 2) AS avg_mood
    FROM mood_logs
    WHERE user_id = ?
    GROUP BY ${groupExpr}
    ORDER BY period DESC
  `;

  const rows = db.prepare(sql).all(user_id);
  return res.json({ success: true, period, rows });
});
