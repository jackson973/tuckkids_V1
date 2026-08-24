/* ============================================================
   Tuck Kids CMS — hidratação de conteúdo (injetado pelo servidor)
   Aplica overrides de textos/imagens de window.__TK sobre o layout
   e dispara eventos de conversão no clique do WhatsApp.
   Sem servidor (ex.: GitHub Pages) window.__TK não existe e o
   arquivo não faz nada — a página estática continua íntegra.
   ============================================================ */
(function () {
  'use strict';

  // Chave estável de um elemento: caminho de índices desde o <body>.
  // Compartilhada com o editor (editor.js) — não alterar sem migrar overrides.
  function keyFor(el) {
    const parts = [];
    let n = el;
    while (n && n !== document.body) {
      const p = n.parentElement;
      if (!p) break;
      parts.unshift(Array.prototype.indexOf.call(p.children, n));
      n = p;
    }
    return parts.join('.');
  }

  function elFor(key) {
    let n = document.body;
    for (const i of String(key).split('.')) {
      n = n && n.children[+i];
      if (!n) return null;
    }
    return n;
  }

  window.__TK_keyFor = keyFor;
  window.__TK_elFor = elFor;

  function hydrate() {
    const TK = window.__TK;
    if (!TK) return;

    // Marca a chave original de cada imagem antes de qualquer troca
    document.querySelectorAll('img').forEach((img) => {
      if (!img.dataset.tkKey) img.dataset.tkKey = img.getAttribute('src');
    });

    // Overrides de texto (por layout)
    for (const [key, html] of Object.entries(TK.textos || {})) {
      const el = elFor(key);
      if (el) el.innerHTML = html;
    }

    // Overrides de imagem (globais — as 3 versões compartilham as fotos)
    for (const [orig, novo] of Object.entries(TK.imagens || {})) {
      document.querySelectorAll(`img[data-tk-key="${CSS.escape(orig)}"]`).forEach((img) => {
        img.setAttribute('src', novo);
      });
    }

    // Reaplica config nos nós possivelmente substituídos pelos overrides
    if (window.__TK_applyConfig) window.__TK_applyConfig();
  }

  // Conversão principal do site: clique em qualquer botão de WhatsApp
  function bindConversionEvents() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[data-wa]');
      if (!a) return;
      try {
        if (typeof gtag === 'function') {
          gtag('event', 'whatsapp_click', { event_category: 'conversao', event_label: a.dataset.wa });
          gtag('event', 'generate_lead');
        }
        if (typeof fbq === 'function') fbq('track', 'Contact');
        if (window.ttq && typeof window.ttq.track === 'function') window.ttq.track('Contact');
        if (window.dataLayer) window.dataLayer.push({ event: 'whatsapp_click', origem: a.dataset.wa });
      } catch (_) { /* rastreamento nunca pode quebrar a navegação */ }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { hydrate(); bindConversionEvents(); });
  } else {
    hydrate();
    bindConversionEvents();
  }
})();
