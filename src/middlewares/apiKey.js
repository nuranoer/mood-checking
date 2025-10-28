export function apiKeyGuard(req, res, next) {
  const headerKey = req.header('x-api-key')
  if (!headerKey || headerKey !== process.env.API_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized' })
  }
  return next()
}
