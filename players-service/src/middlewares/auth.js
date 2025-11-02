
const jwt = require('jsonwebtoken');

function getVerifyOptions() {
  return {
    audience: process.env.JWT_AUDIENCE || 'py-microservices',
    issuer: process.env.JWT_ISSUER || 'auth-service'
  };
}

function verifyToken(token) {
  const pub = process.env.AUTH_PUBLIC_KEY_PEM;     
  const secret = process.env.AUTH_HS256_SECRET;     
  if (pub) {
    return jwt.verify(token, pub, { ...getVerifyOptions(), algorithms: ['RS256'] });
  }
  if (secret) {
    return jwt.verify(token, secret, { ...getVerifyOptions(), algorithms: ['HS256'] });
  }
  throw new Error('No hay clave/token de verificación configurado (AUTH_PUBLIC_KEY_PEM o AUTH_HS256_SECRET).');
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.sendStatus(401);
  const token = auth.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    return res.sendStatus(401);
  }
}

function hasRequiredRole(payload, required) {
  if (!required) return true;
  const needed = Array.isArray(required) ? required : [required];

  const single = payload.role ? [payload.role] : [];
  let many = [];
  if (Array.isArray(payload.roles)) many = payload.roles;
  else if (typeof payload.roles === 'string') {
    many = payload.roles.split(',').map(s => s.trim()).filter(Boolean);
  }

  const roles = new Set([...single, ...many]);
  return needed.some(r => roles.has(r));
}

function requireRole(required) {
  return (req, res, next) => {
    if (!req.user) return res.sendStatus(401);
    if (!hasRequiredRole(req.user, required)) return res.sendStatus(403);
    next();
  };
}


function requireAnyRole(...roles) {
  const flat = roles.flat();
  return [requireAuth, requireRole(flat)];
}

module.exports = { requireAuth, requireRole, requireAnyRole };
