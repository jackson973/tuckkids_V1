// Injeção server-side nos HTMLs dos layouts:
//  - conteúdo (window.__TK) para hidratação e edição
//  - tags de rastreamento/verificação (GA4, GTM, Meta Pixel, TikTok, Search Console)
//  - scripts cms.js (sempre) e editor.js (apenas autenticado)
// As tags entram no <head> real, então crawlers de verificação as enxergam.

function esc(s) {
  return String(s).replace(/[<>"']/g, (c) => ({ '<': '\\u003c', '>': '\\u003e', '"': '\\u0022', "'": '\\u0027' }[c]));
}

// IDs de plataformas: só caracteres seguros para interpolação nos snippets
function safeId(s) {
  return /^[\w-]{1,64}$/.test(String(s || '')) ? String(s) : '';
}

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

function inject(html, { content, layout, authed, user, baseHref, siteUrl }) {
  const boot = {
    layout,
    authed: !!authed,
    user: user ? { nome: user.nome, role: user.role } : undefined,
    config: content.config,
    textos: (content.textos && content.textos[layout]) || {},
    imagens: content.imagens || {},
    secoes: (content.secoes && content.secoes[layout]) || {},
  };

  const headExtra = [
    baseHref ? '<base href="/">' : '',
    `<script>window.__TK=${JSON.stringify(boot).replace(/<\//g, '<\\/')};</script>`,
    trackingTags(content.tracking, siteUrl),
  ].filter(Boolean).join('\n');

  const bodyExtra = [
    `<script src="js/cms.js"></script>`,
    authed ? `<script src="js/editor.js"></script>` : '',
  ].filter(Boolean).join('\n');

  return html
    .replace('<link rel="icon"', headExtra + '\n<link rel="icon"')
    .replace('</body>', bodyExtra + '\n</body>');
}

module.exports = { inject };
