// Camada de armazenamento com dois drivers:
//  - disco (data/): desenvolvimento local, VPS e Docker
//  - Vercel Blob: produção na Vercel (disco é efêmero lá)
// JSONs privados (usuários, auditoria) são criptografados (AES-256-GCM)
// com chave derivada de SESSION_SECRET antes de irem ao Blob.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

// ---------- segredo (compartilhado com auth) ----------
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (useBlob) {
    throw new Error('SESSION_SECRET é obrigatória quando o Vercel Blob está ativo');
  }
  if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, 'utf8');
  const secret = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}
const SECRET = getSecret();
const ENC_KEY = crypto.createHash('sha256').update('tk-store:' + SECRET).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return 'enc1:' + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
function decrypt(payload) {
  const raw = Buffer.from(payload.slice(5), 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

// ---------- driver: Vercel Blob ----------
async function blobGet(name) {
  const { head } = require('@vercel/blob');
  try {
    const meta = await head(`tk/${name}.json`);
    const r = await fetch(meta.url + (meta.url.includes('?') ? '&' : '?') + 'ts=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null; // não existe ainda
  }
}
async function blobSet(name, text) {
  const { put } = require('@vercel/blob');
  await put(`tk/${name}.json`, text, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
  });
}

// ---------- driver: disco ----------
function diskFile(name) { return path.join(DATA_DIR, `${name}.json`); }
function diskGet(name) {
  try { return fs.readFileSync(diskFile(name), 'utf8'); } catch { return null; }
}
function diskSet(name, text) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = diskFile(name) + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, diskFile(name));
}

// ---------- API pública ----------
async function getJSON(name, fallback, { privado = false } = {}) {
  const raw = useBlob ? await blobGet(name) : diskGet(name);
  if (raw === null) return fallback;
  try {
    const text = privado && raw.startsWith('enc1:') ? decrypt(raw) : raw;
    return JSON.parse(text);
  } catch (e) {
    console.error(`[store] falha lendo ${name} (${e.message}) — usando fallback`);
    return fallback;
  }
}

async function setJSON(name, obj, { privado = false } = {}) {
  let text = JSON.stringify(obj, null, privado ? 0 : 2);
  if (privado && useBlob) text = encrypt(text);
  if (useBlob) await blobSet(name, text);
  else diskSet(name, text);
}

// Upload de imagem: Blob (URL pública do CDN) ou data/uploads local
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
async function saveImage(buffer, originalName, mimetype) {
  const ext = (path.extname(originalName || '') || '.jpg').toLowerCase().slice(0, 8);
  const base = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  if (useBlob) {
    const { put } = require('@vercel/blob');
    const blob = await put(`tk/uploads/${base}`, buffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: mimetype,
    });
    return blob.url; // URL absoluta do CDN
  }
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, base), buffer);
  return `uploads/${base}`;
}

module.exports = { getJSON, setJSON, saveImage, SECRET, useBlob, DATA_DIR, UPLOADS_DIR };
