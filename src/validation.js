import { z } from 'zod';

export const moodSchema = z.object({
  user_id: z.string().min(1).max(128),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  mood_score: z.number().int().min(1).max(5),
  mood_label: z.string().min(1).max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable()
});

export function validate(schema) {
  return (req, res, next) => {
    const payload = req.method === 'GET' ? req.query : req.body;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
      });
    }
    req.validated = parsed.data;
    next();
  };
}
