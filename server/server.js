// Tuck Kids — servidor do site + painel de edição inline
// Serve os 3 layouts com conteúdo injetado, API de edição e upload de imagens.
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

const contentStore = require('./lib/content');
const auth = require('./lib/auth');
const { inject } = require('./lib/inject');

const ROOT = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(contentStore.DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

// ---------- páginas dos layouts (com injeção) ----------
function serveLayout(layout) {
  return (req, res) => {
    const file = path.join(ROOT, `${layout}.html`);
    let html;
    try {
      html = fs.readFileSync(file, 'utf8');
    } catch {
      return res.status(404).send('layout não encontrado');
    }
    const content = contentStore.load();
    res.type('html').send(inject(html, { content, layout, authed: auth.isAuthed(req) }));
  };
}

app.get('/', (req, res) => serveLayout(contentStore.load().config.layoutAtivo)(req, res));
for (const layout of contentStore.LAYOUTS) {
  app.get(`/${layout}.html`, serveLayout(layout));
}

// ---------- login ----------
app.get('/admin', (req, res) => {
  if (auth.isAuthed(req)) return res.redirect('/');
  res.sendFile(path.join(ROOT, 'admin', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const ip = req.ip || 'desconhecido';
  if (!auth.loginAllowed(ip)) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
  }
  const ok = auth.checkPassword(req.body && req.body.password);
  auth.registerAttempt(ip, ok);
  if (!ok) return res.status(401).json({ error: 'Senha incorreta.' });
  auth.setSession(res);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  auth.clearSession(res);
  res.json({ ok: true });
});

// ---------- API de conteúdo (autenticada) ----------
app.get('/api/content', auth.requireAuth, (req, res) => {
  res.json(contentStore.load());
});

app.put('/api/content', auth.requireAuth, (req, res) => {
  try {
    res.json(contentStore.applyPatch(req.body || {}));
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'patch inválido' });
  }
});

// ---------- upload de imagens (autenticado) ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype));
  },
});

app.post('/api/upload', auth.requireAuth, upload.single('imagem'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'arquivo inválido (apenas imagens, máx. 8MB)' });
  res.json({ path: `uploads/${req.file.filename}` });
});

// ---------- SEO: sitemap e robots (dinâmicos, usam o host da requisição) ----------
function baseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}
app.get('/sitemap.xml', (req, res) => {
  const base = baseUrl(req);
  const urls = ['/', ...contentStore.LAYOUTS.map((l) => `/${l}.html`)]
    .map((u) => `<url><loc>${base}${u}</loc></url>`).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${baseUrl(req)}/sitemap.xml\n`);
});

// ---------- estáticos ----------
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use('/assets', express.static(path.join(ROOT, 'assets'), { maxAge: '7d' }));
app.use('/css', express.static(path.join(ROOT, 'css')));
app.use('/js', express.static(path.join(ROOT, 'js')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Tuck Kids no ar em http://localhost:${PORT} (admin: /admin)`);
});
