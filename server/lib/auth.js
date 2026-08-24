// Autenticação de admin único: senha com bcrypt + cookie de sessão assinado (HMAC).
// Sem dependência de session store: o cookie carrega expiração + assinatura.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');

const SESSION_DAYS = 7;
const COOKIE_NAME = 'tk_session';

// Segredo de assinatura: env > arquivo persistido > gerado no primeiro boot
function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, 'utf8');
  const secret = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}
const SECRET = getSecret();

// Hash da senha do admin: criado no primeiro boot a partir de ADMIN_PASSWORD
// (ou senha inicial padrão, com aviso). Trocável apagando data/admin.json.
function ensureAdmin() {
  if (fs.existsSync(ADMIN_FILE)) return;
  const initial = process.env.ADMIN_PASSWORD || 'tuckkids2026';
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('[auth] ADMIN_PASSWORD não definida — usando senha inicial "tuckkids2026". TROQUE em produção (defina ADMIN_PASSWORD e apague data/admin.json).');
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ADMIN_FILE, JSON.stringify({ hash: bcrypt.hashSync(initial, 10) }), { mode: 0o600 });
}
ensureAdmin();

function checkPassword(password) {
  const { hash } = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
  return bcrypt.compareSync(String(password || ''), hash);
}

function sign(value) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('hex');
}

function makeSessionCookie() {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  return `${exp}.${sign(String(exp))}`;
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isAuthed(req) {
  const raw = parseCookies(req)[COOKIE_NAME];
  if (!raw) return false;
  const [exp, sig] = raw.split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  return sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function setSession(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${makeSessionCookie()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}${secure}`);
}

function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// Rate limit simples de login por IP: 5 tentativas / 15 min
const attempts = new Map();
function loginAllowed(ip) {
  const now = Date.now();
  const rec = attempts.get(ip) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (now > rec.reset) { rec.count = 0; rec.reset = now + 15 * 60 * 1000; }
  attempts.set(ip, rec);
  return rec.count < 5;
}
function registerAttempt(ip, ok) {
  const rec = attempts.get(ip);
  if (!rec) return;
  if (ok) attempts.delete(ip);
  else rec.count += 1;
}

function requireAuth(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'não autenticado' });
  next();
}

module.exports = { checkPassword, isAuthed, setSession, clearSession, loginAllowed, registerAttempt, requireAuth };
