export function ok(res, data, extra = {}) {
  return res.json({ success: true, data, ...extra })
}
export function fail(res, status, message, details) {
  return res.status(status).json({ success: false, message, details })
}
