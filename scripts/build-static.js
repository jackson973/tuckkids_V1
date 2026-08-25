// Build estático para a Vercel: gera dist/ com as páginas públicas já
// "assadas" com o conteúdo salvo no painel (Blob) + tags de rastreamento.
// É disparado a cada deploy — inclusive pelos Deploy Hooks chamados
// quando alguém salva no painel.
//
//   dist/index.html   → layout ativo (site principal, sem seletor de versões)
//   dist/v1|v2|v3.html→ as três versões (com seletor, para comparação)
//   dist/assets|css|js, robots.txt, sitemap.xml
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const contentStore = require('../server/lib/content');
const { inject } = require('../server/lib/inject');

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
  const ativo = content.config.layoutAtivo;
  console.log(`[build] layout ativo: ${ativo} · modo lançamento: ${content.config.modoLancamento || 'off'}`);

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // estáticos
  copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
  copyDir(path.join(ROOT, 'css'), path.join(DIST, 'css'));
  copyDir(path.join(ROOT, 'js'), path.join(DIST, 'js'));
  // o editor só é servido pela função (/painel) — fora do site público
  fs.rmSync(path.join(DIST, 'js', 'editor.js'), { force: true });

  // páginas: v1/v2/v3 com conteúdo injetado (visitante, sem editor)
  for (const layout of contentStore.LAYOUTS) {
    const html = fs.readFileSync(path.join(ROOT, `${layout}.html`), 'utf8');
    fs.writeFileSync(path.join(DIST, `${layout}.html`),
      inject(html, { content, layout, authed: false, siteUrl: siteUrl() }));
  }

  // index = layout ativo, sem o seletor de versões (site final)
  let indexHtml = fs.readFileSync(path.join(ROOT, `${ativo}.html`), 'utf8');
  indexHtml = indexHtml.replace(/<!-- SELETOR DE VERSOES -->[\s\S]*?<\/nav>\n?/, '');
  fs.writeFileSync(path.join(DIST, 'index.html'),
    inject(indexHtml, { content, layout: ativo, authed: false, siteUrl: siteUrl() }));

  // SEO
  const base = siteUrl();
  fs.writeFileSync(path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /painel\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`);
  if (base) {
    const urls = ['/'].map((u) => `<url><loc>${base}${u}</loc></url>`).join('');
    fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  }

  console.log('[build] dist/ gerado com sucesso');
})().catch((e) => {
  console.error('[build] falhou:', e);
  process.exit(1);
});
