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

    // Overrides de texto (por página)
    for (const [key, html] of Object.entries(TK.textos || {})) {
      const el = elFor(key);
      if (el) el.innerHTML = html;
    }

    // Overrides de imagem (por página)
    for (const [orig, novo] of Object.entries(TK.imagens || {})) {
      document.querySelectorAll(`img[data-tk-key="${CSS.escape(orig)}"]`).forEach((img) => {
        img.setAttribute('src', novo);
      });
    }

    // Seções desativadas no painel: somem para o visitante;
    // no modo edição ficam esmaecidas (o editor mostra o aviso)
    document.querySelectorAll('main > section').forEach((sec, i) => {
      const key = sec.id || ('sec' + i);
      sec.dataset.tkSecao = key;
      if ((TK.secoes || {})[key] === false) {
        if (TK.authed) sec.dataset.tkOculta = '1';
        else sec.style.display = 'none';
      }
    });

    // Reaplica config nos nós possivelmente substituídos pelos overrides
    if (window.__TK_applyConfig) window.__TK_applyConfig();
  }

  // Conversão principal do site: clique em qualquer botão de WhatsApp.
  // Leva junto a origem do visitante (Google/Facebook/Instagram/TikTok/direto),
  // a página vista (teste A/B) e os utm do anúncio — rastreio invisível.
  function bindConversionEvents() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[data-wa]');
      if (!a) return;
      try {
        const TK = window.__TK || {};
        const o = window.__TK_origem || {};
        const extra = {
          origem: o.origem || 'direto', pagina: TK.pagina || '',
          utm_source: o.utm_source || '', utm_medium: o.utm_medium || '', utm_campaign: o.utm_campaign || '',
        };
        if (typeof gtag === 'function') {
          gtag('event', 'whatsapp_click', { event_category: 'conversao', event_label: a.dataset.wa, ...extra });
          gtag('event', 'generate_lead', extra);
        }
        if (typeof fbq === 'function') fbq('track', 'Contact', extra);
        if (window.ttq && typeof window.ttq.track === 'function') window.ttq.track('Contact', extra);
        if (window.dataLayer) window.dataLayer.push({ event: 'whatsapp_click', botao: a.dataset.wa, ...extra });
      } catch (_) { /* rastreamento nunca pode quebrar a navegação */ }
    }, true);
  }

  // ============================================================
  // Modo lançamento: tela de apresentação que cobre o site até a
  // configuração ser finalizada. Easter egg: clicar no T e depois
  // no K de "Tuck Kids" abre o campo de senha; a senha certa
  // libera o site (fica liberado na sessão do navegador).
  // Desativável no painel (Configurações → Modo lançamento).
  // ============================================================
  var LAUNCH_HASH = 'c710bfe84948fb886c51a79a57bc06f2f238333d37d1f4e1f3ed2f75b297f963';

  function launchGate() {
    const TK = window.__TK;
    if (!TK || TK.authed) return;                       // painel nunca é bloqueado
    if ((TK.config || {}).modoLancamento !== 'on') return;
    let unlocked = false;
    try { unlocked = sessionStorage.getItem('tk_unlock') === '1'; } catch (_) {}
    if (unlocked) return;

    const ov = document.createElement('div');
    ov.id = 'tk-launch';
    ov.innerHTML = `
      <style>
        #tk-launch { position: fixed; inset: 0; z-index: 2147483000; background: #FBF7EF; display: grid;
          place-items: center; text-align: center; font-family: 'Nunito Sans', -apple-system, sans-serif; }
        #tk-launch .tk-l-dot { position: absolute; border-radius: 50%; animation: tkfloat 7s ease-in-out infinite; }
        #tk-launch .tk-l-letra { cursor: default; }
        #tk-launch p { margin: 0; font-size: clamp(16px, 2.6vw, 22px); font-weight: 700; color: #6d7894; letter-spacing: .01em; }
        #tk-launch .tk-l-brev { margin-top: 30px; display: inline-flex; align-items: center; gap: 9px;
          background: #fff; border: 1.5px solid rgba(16,27,77,.1); border-radius: 999px; padding: 10px 22px;
          font-size: 13.5px; font-weight: 800; color: #7d9a8d; letter-spacing: .08em; text-transform: uppercase; }
        #tk-launch .tk-l-brev i { width: 9px; height: 9px; border-radius: 50%; background: #e0a291;
          animation: tkfloat 2s ease-in-out infinite; }
        #tk-launch form { margin-top: 26px; display: none; gap: 10px; justify-content: center; }
        #tk-launch form.aberta { display: flex; }
        #tk-launch input { border: 1.5px solid rgba(16,27,77,.2); border-radius: 999px; padding: 12px 20px;
          font: 700 15px 'Nunito Sans', sans-serif; color: #101B4D; width: 210px; text-align: center; outline: none; }
        #tk-launch input:focus { border-color: #4F9993; }
        #tk-launch button { border: 0; border-radius: 999px; padding: 12px 24px; background: #FF6655; color: #fff;
          font: 700 15px 'Nunito Sans', sans-serif; cursor: pointer; }
        #tk-launch .tk-l-erro { animation: tkshake .4s; border-color: #FF6655 !important; }
        @keyframes tkfloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
        @keyframes tkshake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
      </style>
      <div class="tk-l-dot" style="top:12%;left:8%;width:120px;height:120px;background:#a9c3b8;opacity:.35"></div>
      <div class="tk-l-dot" style="bottom:14%;right:10%;width:170px;height:170px;background:#e0a291;opacity:.32;animation-delay:1.2s"></div>
      <div class="tk-l-dot" style="top:22%;right:18%;width:20px;height:20px;background:#a9b2c9;animation-delay:.6s"></div>
      <div class="tk-l-dot" style="bottom:26%;left:16%;width:14px;height:14px;background:#e0a291;animation-delay:2s"></div>
      <div style="position:relative;padding:20px">
        <div style="position:relative;display:inline-block;margin-bottom:2px">
          <img src="assets/img/tuck-logo.png" alt="Tuck Kids" draggable="false"
            style="width:min(88vw,560px);height:auto;user-select:none">
          <span class="tk-l-letra" data-eg="T" style="position:absolute;left:0;top:0;width:38%;height:100%"></span>
          <span class="tk-l-letra" data-eg="K" style="position:absolute;right:0;top:0;width:34%;height:100%"></span>
        </div>
        <p>Vestindo infâncias, criando memórias.</p>
        <div class="tk-l-brev"><i></i>Em breve no ar</div>
        <form autocomplete="off">
          <input type="password" placeholder="senha de acesso" aria-label="Senha de acesso">
          <button type="submit">Entrar</button>
        </form>
      </div>`;
    document.documentElement.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';

    // easter egg: clicar no "t" e depois no "k" da logo (em até 12s)
    let tClicado = 0;
    const form = ov.querySelector('form');
    const input = ov.querySelector('input');
    ov.querySelectorAll('.tk-l-letra').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (el.dataset.eg === 'T') {
          tClicado = Date.now();
        } else if (el.dataset.eg === 'K' && Date.now() - tClicado < 12000) {
          form.classList.add('aberta');
          input.focus();
        }
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let hash = '';
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.value.trim().toLowerCase()));
        hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch (_) {}
      if (hash === LAUNCH_HASH) {
        try { sessionStorage.setItem('tk_unlock', '1'); } catch (_) {}
        document.documentElement.style.overflow = '';
        ov.remove();
        document.dispatchEvent(new CustomEvent('tk:unlock'));
      } else {
        input.value = '';
        input.classList.add('tk-l-erro');
        setTimeout(() => input.classList.remove('tk-l-erro'), 450);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { hydrate(); bindConversionEvents(); launchGate(); });
  } else {
    hydrate();
    bindConversionEvents();
    launchGate();
  }
})();
