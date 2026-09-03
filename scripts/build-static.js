// Build estático para a Vercel: gera dist/ com as páginas públicas já
// "assadas" com o conteúdo salvo no painel (Blob) + tags de rastreamento.
// É disparado a cada deploy — inclusive pelos Deploy Hooks chamados
// quando alguém salva no painel.
//
//   dist/index.html    → página principal (raiz do site)
//   dist/vN.html       → cada página criada no painel
//                        (desativada = redireciona para a raiz)
//   dist/ab.json       → configuração do teste A/B lida pelo middleware.js
//   dist/assets|css|js, robots.txt, sitemap.xml
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const contentStore = require('../server/lib/content');
const { inject, redirectHtml } = require('../server/lib/inject');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return '';
}

(async () => {
  const content = await contentStore.load();
  const principal = content.config.paginaPrincipal;
  const ativas = contentStore.paginasAtivas(content);
  console.log(`[build] conteúdo salvo em: ${content.salvoEm || 'nunca (padrões)'}`);
  console.log(`[build] página principal: ${principal} · ativas: ${ativas.join(', ')} · teste A/B: ${content.ab.ativo} · modo lançamento: ${content.config.modoLancamento || 'off'}`);

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // estáticos
  copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
  copyDir(path.join(ROOT, 'css'), path.join(DIST, 'css'));
  copyDir(path.join(ROOT, 'js'), path.join(DIST, 'js'));
  // o editor só é servido pela função (/painel) — fora do site público
  fs.rmSync(path.join(DIST, 'js', 'editor.js'), { force: true });

  // páginas (visitante, sem editor)
  const template = fs.readFileSync(path.join(ROOT, 'pagina.html'), 'utf8');
  for (const id of contentStore.idsPaginas(content)) {
    const ativa = content.paginas[id].ativa !== false;
    fs.writeFileSync(path.join(DIST, `${id}.html`),
      ativa ? inject(template, { content, pagina: id, authed: false, siteUrl: siteUrl() }) : redirectHtml());
  }

  // páginas legais (estáticas)
  for (const legal of ['termos', 'privacidade']) {
    fs.copyFileSync(path.join(ROOT, `${legal}.html`), path.join(DIST, `${legal}.html`));
  }

  // raiz = página principal (com o teste A/B ligado o middleware
  // reescreve a raiz para a variante sorteada)
  fs.writeFileSync(path.join(DIST, 'index.html'),
    inject(template, { content, pagina: principal, authed: false, siteUrl: siteUrl() }));
  fs.writeFileSync(path.join(DIST, 'ab.json'),
    JSON.stringify({ ativo: content.ab.ativo, pesos: content.ab.pesos, principal }));

  // SEO
  const base = siteUrl();
  fs.writeFileSync(path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /painel\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`);
  if (base) {
    const urls = ['/', '/termos.html', '/privacidade.html'].map((u) => `<url><loc>${base}${u}</loc></url>`).join('');
    fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  }

  console.log('[build] dist/ gerado com sucesso');
})().catch((e) => {
  console.error('[build] falhou:', e);
  process.exit(1);
});
