// Injeção server-side no template da página (pagina.html):
//  - estilo da página (cores, fonte dos títulos, formato dos botões)
//  - conteúdo (window.__TK) para hidratação e edição
//  - tags de rastreamento/verificação (GA4, GTM, Meta Pixel, TikTok, Search Console)
//  - scripts cms.js (sempre) e editor.js (apenas autenticado)
// As tags entram no <head> real, então crawlers de verificação as enxergam.
const fs = require('fs');
const path = require('path');
const { ESTILO_PADRAO, estiloDe, idsPaginas } = require('./content');

const ROOT = path.join(__dirname, '..', '..');
const CSS_BASE = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
const FONTES_CSS = { 'Baloo 2': 'css/fonts-baloo.css', 'Manrope': 'css/fonts-manrope.css' };

function esc(s) {
  return String(s).replace(/[<>"']/g, (c) => ({ '<': '\\u003c', '>': '\\u003e', '"': '\\u0022', "'": '\\u0027' }[c]));
}

// IDs de plataformas: só caracteres seguros para interpolação nos snippets
function safeId(s) {
  return /^[\w-]{1,64}$/.test(String(s || '')) ? String(s) : '';
}

// ---------- estilo por página ----------
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
// mistura a cor com preto (k<0) ou branco (k>0)
function mix(h, k) {
  const [r, g, b] = rgb(h);
  const alvo = k < 0 ? 0 : 255;
  const f = Math.abs(k);
  return hex(r + (alvo - r) * f, g + (alvo - g) * f, b + (alvo - b) * f);
}
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Tokens do template: cor padrão → como aparece no HTML/CSS (hex e rgba)
// e derivados (hover mais escuro, variante mais clara) que acompanham a troca.
const TOKENS = [
  { chave: 'corPrincipal', derivados: { '#e9503f': -0.12 } },
  { chave: 'corEscura', derivados: { '#1A2760': 0.08 } },
  { chave: 'corFundo', derivados: {} },
];

function trocarCor(texto, de, para, derivados) {
  const [r, g, b] = rgb(de);
  const [nr, ng, nb] = rgb(para);
  texto = texto.replace(new RegExp(escRe(de), 'gi'), para);
  texto = texto.replace(new RegExp(`rgba\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*,`, 'g'), `rgba(${nr},${ng},${nb},`);
  for (const [dHex, k] of Object.entries(derivados)) {
    texto = texto.replace(new RegExp(escRe(dHex), 'gi'), mix(para, k));
  }
  return texto;
}

// Aplica o estilo ao HTML do template e devolve o HTML com o CSS base
// embutido (o CSS também recebe as cores, então precisa ir inline).
function aplicarEstilo(html, estilo) {
  let css = CSS_BASE;
  const links = [];
  for (const t of TOKENS) {
    const de = ESTILO_PADRAO[t.chave];
    const para = (estilo[t.chave] || de).toUpperCase();
    if (para === de.toUpperCase()) continue;
    html = trocarCor(html, de, para, t.derivados);
    css = trocarCor(css, de, para, t.derivados);
  }
  const fonte = estilo.fonteTitulos || ESTILO_PADRAO.fonteTitulos;
  if (fonte !== ESTILO_PADRAO.fonteTitulos) {
    html = html.replace(/'Poppins'/g, `'${fonte}'`);
    css = css.replace(/'Poppins'/g, `'${fonte}'`);
    if (FONTES_CSS[fonte]) links.push(`<link rel="stylesheet" href="${FONTES_CSS[fonte]}">`);
  }
  if ((estilo.botoes || ESTILO_PADRAO.botoes) === 'reto') {
    html = html.replace(/border-radius:\s*999px/g, 'border-radius:8px');
  }
  return html.replace('<link rel="stylesheet" href="css/style.css">',
    links.concat(`<style id="tk-css">\n${css}\n</style>`).join('\n'));
}

// ---------- rastreamento ----------
function trackingTags(tracking, siteUrl) {
  const t = tracking || {};
  const parts = [];

  if (t.googleSiteVerification) {
    parts.push(`<meta name="google-site-verification" content="${esc(t.googleSiteVerification)}">`);
  }
  if (t.facebookDomainVerification) {
    parts.push(`<meta name="facebook-domain-verification" content="${esc(t.facebookDomainVerification)}">`);
  }
  // Imagem de compartilhamento: a configurada no painel ou, por padrão,
  // o cartão gerado com a logo (assets/img/og-card.jpg)
  const og = t.ogImage || (siteUrl ? `${siteUrl}/assets/img/og-card.jpg` : '');
  if (og) {
    parts.push(`<meta property="og:image" content="${esc(og)}">`);
    parts.push('<meta property="og:image:width" content="1200">');
    parts.push('<meta property="og:image:height" content="630">');
  }

  const gtm = safeId(t.gtmId);
  if (gtm) {
    parts.push(`<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');</script>`);
  }

  const ga4 = safeId(t.ga4Id);
  if (ga4) {
    parts.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${ga4}"></script>`);
    parts.push(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4}');</script>`);
  }

  const pixel = safeId(t.metaPixelId);
  if (pixel) {
    parts.push(`<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');</script>`);
    parts.push(`<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixel}&ev=PageView&noscript=1"></noscript>`);
  }

  const ttk = safeId(t.tiktokPixelId);
  if (ttk) {
    parts.push(`<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${ttk}');ttq.page();}(window,document,'ttq');</script>`);
  }

  return parts.join('\n');
}

// ---------- montagem ----------
function inject(html, { content, pagina, authed, user, baseHref, siteUrl }) {
  const p = content.paginas[pagina];
  const estilo = estiloDe(content, pagina);
  html = aplicarEstilo(html, estilo);

  const boot = {
    pagina,
    nomePagina: p.nome,
    authed: !!authed,
    user: user ? { nome: user.nome, role: user.role } : undefined,
    config: content.config,
    textos: p.textos || {},
    imagens: p.imagens || {},
    secoes: p.secoes || {},
    estilo,
    estiloPadrao: ESTILO_PADRAO,
    origem: content.origem || {},
    vsl: content.vsl || {},
  };
  // lista de páginas e teste A/B: só quem edita precisa
  if (authed) {
    boot.paginas = idsPaginas(content).map((id) => ({
      id, nome: content.paginas[id].nome, ativa: content.paginas[id].ativa !== false,
      principal: id === content.config.paginaPrincipal, criadaEm: content.paginas[id].criadaEm,
    }));
    boot.ab = content.ab;
  }

  const headExtra = [
    baseHref ? '<base href="/">' : '',
    `<script>window.__TK=${JSON.stringify(boot).replace(/<\//g, '<\\/')};</script>`,
    trackingTags(content.tracking, siteUrl),
  ].filter(Boolean).join('\n');

  const bodyExtra = [
    `<script src="js/cms.js"></script>`,
    (content.vsl && (content.vsl.videoUrl || content.vsl.videoUrlMobile)) ? `<script src="js/player.js"></script>` : '',
    authed ? `<script src="js/editor.js"></script>` : '',
  ].filter(Boolean).join('\n');

  return html
    .replace('<link rel="icon"', headExtra + '\n<link rel="icon"')
    .replace('</body>', bodyExtra + '\n</body>');
}

// Página desativada: quem cair no endereço dela vai para a principal,
// preservando os parâmetros da URL (utm etc.)
function redirectHtml() {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Tuck Kids</title><meta http-equiv="refresh" content="0; url=/">
<script>location.replace('/' + location.search + location.hash);</script></head>
<body><p>Redirecionando… <a href="/">Ir para o site</a></p></body></html>`;
}

module.exports = { inject, aplicarEstilo, redirectHtml };
