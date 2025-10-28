import Joi from 'joi'

export const createMoodSchema = Joi.object({
  user_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim().max(64)).required(),
  date: Joi.string().isoDate().required(), // ISO 8601 date string
  mood_score: Joi.number().integer().min(1).max(5).required(),
  mood_label: Joi.string().trim().max(50).optional(),
  notes: Joi.string().trim().max(1000).optional()
})

export const listMoodSchema = Joi.object({
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(20)
})

export const summarySchema = Joi.object({
  period: Joi.string().valid('week', 'month').default('week'),
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional()
})
