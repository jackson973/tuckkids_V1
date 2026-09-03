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
const TEMPLATE = path.join(ROOT, 'pagina.html');
const AB_COOKIE = 'tk_ab';

function cookieValue(req, nome) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return '';
}

// Sorteio ponderado (pesos em %) — mesma lógica do middleware.js na Vercel
function sortear(pesos) {
  const ids = Object.keys(pesos);
  const total = ids.reduce((s, id) => s + pesos[id], 0);
  let r = Math.random() * total;
  for (const id of ids) { r -= pesos[id]; if (r < 0) return id; }
  return ids[ids.length - 1];
}

// Raiz "/": página principal ou, com o teste A/B ligado, a variante
// sorteada — lembrada por cookie para o visitante ver sempre a mesma.
function paginaDaRaiz(content, req, res) {
  const ab = content.ab || {};
  const ids = Object.keys(ab.pesos || {});
  if (ab.ativo !== 'on' || ids.length < 2) return content.config.paginaPrincipal;
  const lembrada = cookieValue(req, AB_COOKIE);
  if (ids.includes(lembrada)) return lembrada;
  const escolhida = sortear(ab.pesos);
  res.setHeader('Set-Cookie', `${AB_COOKIE}=${escolhida}; Path=/; Max-Age=2592000; SameSite=Lax`);
  return escolhida;
}

async function renderPagina(req, res, content, pagina, opts) {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  const user = await auth.userFromReq(req);
  res.type('html').send(inject(html, { content, pagina, authed: !!user, user, ...(opts || {}) }));
}

// Painel: edição ao vivo de qualquer página (inclusive desativadas)
app.get(['/painel', '/painel/:pagina'], async (req, res, next) => {
  try {
    const user = await auth.userFromReq(req);
    if (!user) return res.redirect('/admin');
    const content = await contentStore.load();
    const pagina = content.paginas[req.params.pagina] ? req.params.pagina : content.config.paginaPrincipal;
    const html = fs.readFileSync(TEMPLATE, 'utf8');
    res.type('html').send(inject(html, { content, pagina, authed: true, user, baseHref: true }));
  } catch (e) { next(e); }
});

// Site dinâmico (dev/VPS; na Vercel as estáticas + middleware têm precedência)
app.get('/', async (req, res, next) => {
  try {
    const content = await contentStore.load();
    await renderPagina(req, res, content, paginaDaRaiz(content, req, res));
  } catch (e) { next(e); }
});
app.get(/^\/(v\d{1,3})\.html$/, async (req, res, next) => {
  try {
    const content = await contentStore.load();
    const p = content.paginas[req.params[0]];
    if (!p) return res.status(404).send('página não encontrada');
    // desativada: leva para a principal sem perder os parâmetros da URL (utm)
    if (p.ativa === false) return res.redirect(302, '/' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));
    await renderPagina(req, res, content, req.params[0]);
  } catch (e) { next(e); }
});

// Páginas legais (estáticas, fora do template editável)
for (const legal of ['termos', 'privacidade']) {
  app.get(`/${legal}.html`, (req, res) => res.sendFile(path.join(ROOT, `${legal}.html`)));
}

// ---------- login ----------
app.get('/admin', async (req, res) => {
  if (await auth.userFromReq(req)) return res.redirect('/painel');
  if (await auth.setupPendente()) return res.sendFile(path.join(ROOT, 'admin', 'setup.html'));
  res.sendFile(path.join(ROOT, 'admin', 'login.html'));
});

// Configuração inicial: cria o primeiro admin (só funciona com o sistema zerado)
app.post('/api/setup', async (req, res) => {
  try {
    const u = await auth.createFirstAdmin(req.body || {});
    auth.setSession(res, u.id);
    await audit.record(u, 'setup', 'primeiro administrador criado na configuração inicial');
    res.json({ ok: true, nome: u.nome });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
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
  let patched;
  try {
    patched = await contentStore.applyPatch(req.body || {});
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  try {
    await audit.record(req.user, 'conteudo_alterado', patched.resumo);
    const publicando = await triggerDeploy(req.user, `automática após salvar (${patched.resumo})`);
    res.json({ ok: true, content: patched.content, publicando });
  } catch (e) { next(e); }
});

// Republicação manual (regenera as páginas estáticas sem mudar conteúdo)
app.post('/api/publish', auth.requireAuth, async (req, res, next) => {
  try {
    const publicando = await triggerDeploy(req.user, 'manual');
    res.json({ ok: true, publicando });
  } catch (e) { next(e); }
});

// ---------- páginas: clonar / excluir ----------
app.post('/api/paginas/clonar', auth.requireAuth, async (req, res, next) => {
  let r;
  try {
    r = await contentStore.clonar(String((req.body || {}).de || ''), (req.body || {}).nome);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  try {
    await audit.record(req.user, 'pagina_clonada', `${r.pagina.nome} (${r.id}) a partir de ${r.pagina.clonadaDe}`);
    const publicando = await triggerDeploy(req.user, `automática após clonar página ${r.id}`);
    res.json({ ok: true, id: r.id, publicando });
  } catch (e) { next(e); }
});

app.delete('/api/paginas/:id', auth.requireAuth, async (req, res, next) => {
  let r;
  try {
    r = await contentStore.excluir(req.params.id);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  try {
    await audit.record(req.user, 'pagina_excluida', `${r.nome} (${req.params.id})`);
    const publicando = await triggerDeploy(req.user, `automática após excluir página ${req.params.id}`);
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

// ---------- upload de vídeo da VSL ----------
// Na Vercel as funções limitam o corpo a ~4,5MB: o vídeo sobe DIRETO do
// navegador para o Blob (client upload) e esta rota só emite o token.
// Em dev/VPS (disco) recebe o arquivo via multipart normal.
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(store.UPLOADS_DIR, { recursive: true });
      cb(null, store.UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname || '') || '.mp4').toLowerCase().slice(0, 8);
      cb(null, `${Date.now()}-video${ext}`);
    },
  }),
  limits: { fileSize: 300 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^video\/(mp4|webm)$/.test(file.mimetype)),
});

app.get('/api/video-upload', auth.requireAuth, (req, res) => {
  res.json({ mode: store.useBlob ? 'blob' : 'disk' });
});

app.post('/api/video-upload', auth.requireAuth, (req, res, next) => {
  if (!store.useBlob) {
    return videoUpload.single('video')(req, res, async (err) => {
      try {
        if (err || !req.file) return res.status(400).json({ error: 'vídeo inválido (mp4/webm, máx. 300MB)' });
        await audit.record(req.user, 'video_enviado', `${req.file.originalname} (${Math.round(req.file.size / 1048576)}MB)`);
        res.json({ url: `uploads/${req.file.filename}` });
      } catch (e) { next(e); }
    });
  }
  (async () => {
    const { handleUpload } = require('@vercel/blob/client');
    const user = req.user;
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        await audit.record(user, 'video_enviado', pathname);
        return {
          allowedContentTypes: ['video/mp4', 'video/webm'],
          maximumSizeInBytes: 500 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    res.json(jsonResponse);
  })().catch(next);
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
app.get('/sitemap.xml', async (req, res, next) => {
  try {
    const content = await contentStore.load();
    const urls = ['/', ...contentStore.paginasAtivas(content).map((id) => `/${id}.html`), '/termos.html', '/privacidade.html']
      .map((u) => `<url><loc>${baseUrl(req)}${u}</loc></url>`).join('');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  } catch (e) { next(e); }
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
