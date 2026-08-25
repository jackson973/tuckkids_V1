// Autenticação multiusuário (admin | editor) para o painel.
// Usuários ficam no store como JSON privado (criptografado no Blob).
// Sessão: cookie httpOnly assinado (HMAC) carregando o id do usuário.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const store = require('./store');

const SESSION_DAYS = 7;
const COOKIE_NAME = 'tk_session';
const ROLES = ['admin', 'editor'];

// ---------- usuários ----------
async function getUsers() {
  const data = await store.getJSON('users', null, { privado: true });
  if (data && Array.isArray(data.users) && data.users.length) return data.users;
  // bootstrap: primeiro admin a partir de ADMIN_PASSWORD
  const initial = process.env.ADMIN_PASSWORD || 'tuckkids2026';
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('[auth] ADMIN_PASSWORD não definida — admin inicial com senha "tuckkids2026". TROQUE em produção.');
  }
  const users = [{
    id: 'u_' + crypto.randomBytes(4).toString('hex'),
    login: 'admin',
    nome: 'Administrador',
    hash: bcrypt.hashSync(initial, 10),
    role: 'admin',
    ativo: true,
    criadoEm: new Date().toISOString(),
  }];
  await store.setJSON('users', { users }, { privado: true });
  return users;
}

async function saveUsers(users) {
  await store.setJSON('users', { users }, { privado: true });
}

function publicUser(u) {
  return { id: u.id, login: u.login, nome: u.nome, role: u.role, ativo: u.ativo, criadoEm: u.criadoEm };
}

async function checkLogin(login, password) {
  const users = await getUsers();
  const user = users.find((u) => u.login === String(login || '').toLowerCase().trim() && u.ativo);
  if (!user) { bcrypt.compareSync('x', '$2a$10$abcdefghijklmnopqrstuv'); return null; } // tempo constante
  return bcrypt.compareSync(String(password || ''), user.hash) ? user : null;
}

async function createUser({ login, nome, senha, role }) {
  const users = await getUsers();
  login = String(login || '').toLowerCase().trim();
  if (!/^[a-z0-9._-]{3,40}$/.test(login)) throw new Error('login inválido (3-40 caracteres, letras/números/._-)');
  if (users.some((u) => u.login === login)) throw new Error('já existe usuário com esse login');
  if (!senha || String(senha).length < 8) throw new Error('senha precisa de pelo menos 8 caracteres');
  if (!ROLES.includes(role)) role = 'editor';
  const user = {
    id: 'u_' + crypto.randomBytes(4).toString('hex'),
    login,
    nome: String(nome || login).slice(0, 80),
    hash: bcrypt.hashSync(String(senha), 10),
    role,
    ativo: true,
    criadoEm: new Date().toISOString(),
  };
  users.push(user);
  await saveUsers(users);
  return publicUser(user);
}

async function updateUser(id, patch, atorId) {
  const users = await getUsers();
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error('usuário não encontrado');
  if (typeof patch.nome === 'string') user.nome = patch.nome.slice(0, 80);
  if (ROLES.includes(patch.role)) {
    if (user.id === atorId && patch.role !== 'admin') throw new Error('você não pode rebaixar a si mesmo');
    user.role = patch.role;
  }
  if (typeof patch.ativo === 'boolean') {
    if (user.id === atorId && !patch.ativo) throw new Error('você não pode desativar a si mesmo');
    user.ativo = patch.ativo;
  }
  if (patch.senha) {
    if (String(patch.senha).length < 8) throw new Error('senha precisa de pelo menos 8 caracteres');
    user.hash = bcrypt.hashSync(String(patch.senha), 10);
  }
  const admins = users.filter((u) => u.role === 'admin' && u.ativo);
  if (!admins.length) throw new Error('o sistema precisa de pelo menos um admin ativo');
  await saveUsers(users);
  return publicUser(user);
}

async function listUsers() {
  return (await getUsers()).map(publicUser);
}

// ---------- sessão ----------
function sign(value) {
  return crypto.createHmac('sha256', store.SECRET).update(value).digest('hex');
}

function makeSessionCookie(userId) {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  return `${userId}.${exp}.${sign(`${userId}.${exp}`)}`;
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function userFromReq(req) {
  const raw = parseCookies(req)[COOKIE_NAME];
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  if (Number(exp) < Date.now()) return null;
  const expected = sign(`${uid}.${exp}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const users = await getUsers();
  const user = users.find((u) => u.id === uid && u.ativo);
  return user ? publicUser(user) : null;
}

function setSession(res, userId) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${makeSessionCookie(userId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}${secure}`);
}

function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// Rate limit de login por IP (por instância; em serverless é melhor-esforço,
// complementado pelo custo do bcrypt e pelo registro em auditoria)
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

// ---------- middlewares ----------
function requireAuth(req, res, next) {
  userFromReq(req).then((user) => {
    if (!user) return res.status(401).json({ error: 'não autenticado' });
    req.user = user;
    next();
  }).catch(next);
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'apenas administradores' });
    next();
  });
}

module.exports = {
  checkLogin, listUsers, createUser, updateUser, userFromReq,
  setSession, clearSession, loginAllowed, registerAttempt,
  requireAuth, requireAdmin,
};
