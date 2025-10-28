let logged = false

export function apiKeyGuard(req, res, next) {
  const headerKey = (req.header('x-api-key') || '').trim()
  const serverKey = (process.env.API_KEY || '').trim()

  if (headerKey !== serverKey) {
    if (!logged) {
      // Debug sekali agar tidak flooding terminal
      console.warn('[API-KEY MISMATCH]',
        { headerKey, serverKey, equal: headerKey === serverKey })
      logged = true
    }
    return res.status(401).json({ success: false, message: 'Unauthorized' })
  }
  return next()
}
