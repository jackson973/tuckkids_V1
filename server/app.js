// Tuck Kids — aplicação Express (exportada sem listen para rodar
// tanto em servidor próprio quanto como função na Vercel).
//
// Na Vercel as páginas públicas são ESTÁTICAS (geradas no build);
// esta aplicação atende /admin, /painel (edição ao vivo) e /api/*.
// Em dev/VPS ela serve o site inteiro dinamicamente.
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

const contentStore = require('./lib/content');
const auth = require('./lib/auth');
const audit = require('./lib/audit');
const store = require('./lib/store');
const { inject } = require('./lib/inject');

const ROOT = path.join(__dirname, '..');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

// ---------- publicação (Deploy Hook da Vercel) ----------
// Toda gravação de conteúdo dispara um novo build para regenerar
// as páginas estáticas publicadas.
async function triggerDeploy(user, motivo) {
  const hook = process.env.DEPLOY_HOOK_URL;
  if (!hook) return false;
  try {
    await fetch(hook, { method: 'POST' });
    await audit.record(user, 'publicacao', motivo);
    return true;
  } catch (e) {
    console.error('[deploy] falha ao disparar build:', e.message);
    return false;
  }
}

// ---------- páginas ----------
async function renderLayout(req, res, layout) {
  const file = path.join(ROOT, `${layout}.html`);
  let html;
  try {
    html = fs.readFileSync(file, 'utf8');
  } catch {
    return res.status(404).send('layout não encontrado');
  }
  const [content, user] = await Promise.all([contentStore.load(), auth.userFromReq(req)]);
  res.type('html').send(inject(html, { content, layout, authed: !!user, user }));
}

// Painel: edição ao vivo (sempre lê o conteúdo mais recente do store)
app.get(['/painel', '/painel/:layout'], async (req, res, next) => {
  try {
    const user = await auth.userFromReq(req);
    if (!user) return res.redirect('/admin');
    const content = await contentStore.load();
    const layout = contentStore.LAYOUTS.includes(req.params.layout)
      ? req.params.layout : content.config.layoutAtivo;
    const html = fs.readFileSync(path.join(ROOT, `${layout}.html`), 'utf8');
    res.type('html').send(inject(html, { content, layout, authed: true, user }));
  } catch (e) { next(e); }
});

// Site dinâmico (dev/VPS; na Vercel as estáticas têm precedência)
app.get('/', async (req, res, next) => {
  try {
    const content = await contentStore.load();
    await renderLayout(req, res, content.config.layoutAtivo);
  } catch (e) { next(e); }
});
for (const layout of contentStore.LAYOUTS) {
  app.get(`/${layout}.html`, (req, res, next) => renderLayout(req, res, layout).catch(next));
}

// ---------- login ----------
app.get('/admin', async (req, res) => {
  if (await auth.userFromReq(req)) return res.redirect('/painel');
  res.sendFile(path.join(ROOT, 'admin', 'login.html'));
});

app.post('/api/login', async (req, res, next) => {
  try {
    const ip = req.ip || 'desconhecido';
    if (!auth.loginAllowed(ip)) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
    }
    const { login, password } = req.body || {};
    const user = await auth.checkLogin(login, password);
    auth.registerAttempt(ip, !!user);
    if (!user) {
      await audit.record(null, 'login_falhou', `login "${String(login || '').slice(0, 40)}" · IP ${ip}`);
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }
    auth.setSession(res, user.id);
    await audit.record(user, 'login', `IP ${ip}`);
    res.json({ ok: true, nome: user.nome, role: user.role });
  } catch (e) { next(e); }
});

app.post('/api/logout', (req, res) => {
  auth.clearSession(res);
  res.json({ ok: true });
});

// ---------- conteúdo ----------
app.get('/api/content', auth.requireAuth, async (req, res, next) => {
  try { res.json(await contentStore.load()); } catch (e) { next(e); }
});

app.put('/api/content', auth.requireAuth, async (req, res, next) => {
  try {
    const { content, resumo } = await contentStore.applyPatch(req.body || {});
    await audit.record(req.user, 'conteudo_alterado', resumo);
    const publicando = await triggerDeploy(req.user, `automática após salvar (${resumo})`);
    res.json({ ok: true, content, publicando });
  } catch (e) { next(e); }
});

// Republicação manual (regenera as páginas estáticas sem mudar conteúdo)
app.post('/api/publish', auth.requireAuth, async (req, res, next) => {
  try {
    const publicando = await triggerDeploy(req.user, 'manual');
    res.json({ ok: true, publicando });
  } catch (e) { next(e); }
});

// ---------- upload de imagens ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)),
});

app.post('/api/upload', auth.requireAuth, upload.single('imagem'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'arquivo inválido (apenas imagens, máx. 8MB)' });
    const p = await store.saveImage(req.file.buffer, req.file.originalname, req.file.mimetype);
    await audit.record(req.user, 'imagem_enviada', `${req.file.originalname} (${Math.round(req.file.size / 1024)}KB) → ${p}`);
    res.json({ path: p });
  } catch (e) { next(e); }
});

// ---------- gestão de usuários (somente admin) ----------
app.get('/api/users', auth.requireAdmin, async (req, res, next) => {
  try { res.json(await auth.listUsers()); } catch (e) { next(e); }
});

app.post('/api/users', auth.requireAdmin, async (req, res, next) => {
  try {
    const u = await auth.createUser(req.body || {});
    await audit.record(req.user, 'usuario_criado', `${u.nome} (${u.login}) · papel ${u.role}`);
    res.json(u);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch('/api/users/:id', auth.requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const u = await auth.updateUser(req.params.id, body, req.user.id);
    const mudou = ['nome', 'role', 'ativo'].filter((k) => k in body).concat(body.senha ? ['senha'] : []);
    await audit.record(req.user, 'usuario_alterado', `${u.login}: ${mudou.join(', ')}`);
    res.json(u);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------- auditoria (somente admin) ----------
app.get('/api/audit', auth.requireAdmin, async (req, res, next) => {
  try { res.json(await audit.list(200)); } catch (e) { next(e); }
});

// ---------- SEO dinâmico (dev/VPS; na Vercel são estáticos do build) ----------
function baseUrl(req) { return `${req.protocol}://${req.get('host')}`; }
app.get('/sitemap.xml', (req, res) => {
  const urls = ['/', ...contentStore.LAYOUTS.map((l) => `/${l}.html`)]
    .map((u) => `<url><loc>${baseUrl(req)}${u}</loc></url>`).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /painel\nSitemap: ${baseUrl(req)}/sitemap.xml\n`);
});

// ---------- estáticos (dev/VPS; na Vercel vêm do CDN) ----------
app.use('/uploads', express.static(store.UPLOADS_DIR, { maxAge: '7d' }));
app.use('/assets', express.static(path.join(ROOT, 'assets'), { maxAge: '7d' }));
app.use('/css', express.static(path.join(ROOT, 'css')));
app.use('/js', express.static(path.join(ROOT, 'js')));

// ---------- erros ----------
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'erro interno' });
});

module.exports = app;
