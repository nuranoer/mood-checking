import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.API_KEY;

export function apiKeyAuth(req, res, next) {
  const header = req.header('x-api-key') || req.query.api_key;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing API_KEY' });
  }
  if (!header || header !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
