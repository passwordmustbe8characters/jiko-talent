// Single-admin login: scrypt password hash + HMAC-signed token. No extra packages needed.
import crypto from 'node:crypto';

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function secret() {
  const s = process.env.ADMIN_TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error('ADMIN_TOKEN_SECRET is missing or too short (needs 32+ characters)');
  return s;
}

/** Format: scrypt:<salt>:<hash>  (colons, so .env parsing can't mangle it) */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${b64(salt)}:${b64(hash)}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored ?? '').split(':');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = crypto.scryptSync(String(password ?? ''), Buffer.from(saltB64, 'base64url'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export function signToken(ttlMs = TOKEN_TTL_MS) {
  const payload = b64(JSON.stringify({ exp: Date.now() + ttlMs }));
  const sig = b64(crypto.createHmac('sha256', secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyToken(token) {
  try {
    const [payload, sig] = String(token ?? '').split('.');
    if (!payload || !sig) return false;
    const expected = crypto.createHmac('sha256', secret()).update(payload).digest();
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!verifyToken(token)) return res.status(401).json({ error: 'Not signed in' });
  next();
}

// Allow 5 wrong passwords per 15 minutes per address.
const attempts = new Map();
export function loginAllowed(ip) {
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < Date.now()) return true;
  return rec.count < 5;
}
export function recordFailure(ip) {
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < Date.now()) attempts.set(ip, { count: 1, resetAt: Date.now() + 15 * 60 * 1000 });
  else rec.count += 1;
}
export function clearFailures(ip) {
  attempts.delete(ip);
}
