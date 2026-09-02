/* ============================================================
   Tuck Kids — Landing page
   Configuração + interações (menu, FAQ, contadores, WhatsApp)
   Com servidor: window.__TK (injetado) sobrescreve a configuração.
   Sem servidor (GitHub Pages): usa os valores padrão abaixo.
   ============================================================ */

// TODO: substituir pelo número oficial de WhatsApp da Tuck Kids (formato: 55 + DDD + número)
const TK_CONFIG = Object.assign({
  whatsappNumber: '5547999999999',
  pedidoMinimo: 'R$ 2.000',
}, (window.__TK && window.__TK.config) || {});

// ============================================================
// Origem do visitante (Google, Facebook, Instagram, TikTok ou direto)
// Ordem de confiança: utm_source do anúncio → id de clique (gclid,
// fbclid, ttclid) → site de onde veio (referrer) → "direto".
// Primeiro toque: a primeira origem detectada fica guardada por 30 dias,
// mesmo que a pessoa volte depois digitando o endereço.
// ============================================================
const TK_ORIGEM_KEY = 'tk_origem';
const TK_ORIGEM_DIAS = 30;

function detectarOrigem() {
  const q = new URLSearchParams(location.search);
  const src = (q.get('utm_source') || '').toLowerCase();
  const info = {
    utm_source: q.get('utm_source') || '', utm_medium: q.get('utm_medium') || '',
    utm_campaign: q.get('utm_campaign') || '', utm_content: q.get('utm_content') || '',
  };
  let origem = '';
  if (src) {
    // Meta Ads com utm_source={{site_source_name}} manda fb, ig, msg ou an
    if (/^(ig|instagram)/.test(src)) origem = 'instagram';
    else if (/^(fb|facebook|meta|msg|an)$/.test(src) || /facebook|meta/.test(src)) origem = 'facebook';
    else if (/tiktok|^tt$/.test(src)) origem = 'tiktok';
    else if (/google|adwords|gads|youtube/.test(src)) origem = 'google';
  }
  if (!origem) {
    if (q.get('gclid') || q.get('gbraid') || q.get('wbraid')) origem = 'google';
    else if (q.get('fbclid')) origem = 'facebook';
    else if (q.get('ttclid')) origem = 'tiktok';
  }
  if (!origem && document.referrer) {
    let host = '';
    try { host = new URL(document.referrer).hostname; } catch (_) {}
    if (host && host !== location.hostname) {
      if (/(^|\.)google\./.test(host) || /(^|\.)youtube\.com$/.test(host)) origem = 'google';
      else if (/(^|\.)instagram\.com$/.test(host)) origem = 'instagram';
      else if (/(^|\.)(facebook|fb|messenger)\.com$/.test(host)) origem = 'facebook';
      else if (/(^|\.)tiktok\.com$/.test(host)) origem = 'tiktok';
    }
  }
  return { origem: origem || 'direto', detectada: !!origem, info };
}

// Devolve a origem do visitante (guardada ou recém-detectada)
function origemVisitante() {
  const agora = Date.now();
  let salva = null;
  try { salva = JSON.parse(localStorage.getItem(TK_ORIGEM_KEY) || 'null'); } catch (_) {}
  if (salva && salva.ts && agora - salva.ts < TK_ORIGEM_DIAS * 86400000) {
    // primeiro toque: só uma visita "direta" guardada cede lugar a uma origem real
    if (salva.origem !== 'direto') return salva;
  }
  const d = detectarOrigem();
  if (!d.detectada && salva) return salva;
  const nova = { origem: d.origem, ts: agora, ...d.info };
  try { localStorage.setItem(TK_ORIGEM_KEY, JSON.stringify(nova)); } catch (_) {}
  return nova;
}
window.__TK_origem = origemVisitante();

// Mensagens do WhatsApp = abertura conforme a origem (editável no painel)
// + intenção do botão. Uma página pode sobrescrever as intenções definindo
// window.TK_MSG_OVERRIDES antes deste script.
const WA_ABERTURAS = Object.assign({
  google: 'Olá, vim do site e gostaria de mais informações.',
  facebook: 'Olá, gostaria de mais informações sobre a Tuck Kids.',
  instagram: 'Olá, vi a Tuck Kids no Instagram e quero saber mais.',
  tiktok: 'Olá, vi a Tuck Kids no TikTok e quero saber mais.',
  direto: 'Olá!',
}, (window.__TK && window.__TK.origem) || {});

const WA_MESSAGES = Object.assign({
  catalogo: 'Quero receber o catálogo Tuck Kids.',
  especialista: 'Quero falar com um especialista da Tuck Kids.',
  video: 'Quero agendar uma videochamada para conhecer a fábrica da Tuck Kids.',
  representante: 'Quero ser representante Tuck Kids.',
  conhecer: 'Quero conhecer a Tuck Kids.',
}, window.TK_MSG_OVERRIDES || {});

function waMensagem(messageKey) {
  const abertura = (WA_ABERTURAS[window.__TK_origem.origem] || WA_ABERTURAS.direto || '').trim();
  const intencao = WA_MESSAGES[messageKey] || WA_MESSAGES.catalogo;
  return (abertura ? abertura + ' ' : '') + intencao;
}

function waLink(messageKey) {
  const num = String(TK_CONFIG.whatsappNumber).replace(/\D/g, '');
  return 'https://wa.me/' + num + '?text=' + encodeURIComponent(waMensagem(messageKey));
}
window.__TK_waLink = waLink;

// Preenche links de WhatsApp, pedido mínimo e redes sociais.
// Idempotente: o cms.js chama de novo após aplicar overrides de texto.
window.__TK_applyConfig = function applyConfig() {
  document.querySelectorAll('[data-wa]').forEach((el) => {
    el.setAttribute('href', waLink(el.dataset.wa));
  });
  document.querySelectorAll('[data-cfg="pedidoMinimo"]').forEach((el) => {
    el.textContent = TK_CONFIG.pedidoMinimo;
  });
  document.querySelectorAll('a[aria-label="Instagram"]').forEach((el) => {
    if (TK_CONFIG.instagram) el.setAttribute('href', TK_CONFIG.instagram);
  });
  document.querySelectorAll('a[aria-label="Facebook"]').forEach((el) => {
    if (TK_CONFIG.facebook) el.setAttribute('href', TK_CONFIG.facebook);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  window.__TK_applyConfig();

  // Botão de play do vídeo (VSL) — abre conversa no WhatsApp
  const vslPlay = document.getElementById('vsl-play');
  if (vslPlay) {
    vslPlay.addEventListener('click', () => window.open(waLink('conhecer'), '_blank'));
  }

  // Menu mobile
  const menuBtn = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      menuBtn.textContent = open ? '✕' : '☰';
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    mobileMenu.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        menuBtn.textContent = '☰';
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // FAQ (acordeão) — um item aberto por vez
  const faqItems = Array.from(document.querySelectorAll('.faq-item'));
  faqItems.forEach((item) => {
    const btn = item.querySelector('button');
    btn.addEventListener('click', () => {
      const willOpen = !item.classList.contains('open');
      faqItems.forEach((i) => {
        i.classList.remove('open');
        i.querySelector('button').setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Contadores animados da seção "Números"
  const numeros = document.getElementById('numeros');
  if (numeros) {
    const targets = { anos: 7, pecas: 1000000, clientes: 2000 };
    const elAnos = document.getElementById('stat-anos');
    const elPecas = document.getElementById('stat-pecas');
    const elClientes = document.getElementById('stat-clientes');

    const render = (a, p, cl) => {
      elAnos.textContent = '+' + a + ' anos';
      elPecas.textContent = p >= 1000000 ? '+1 milhão' : '+' + p.toLocaleString('pt-BR');
      elClientes.textContent = '+' + cl.toLocaleString('pt-BR');
    };

    const animate = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        render(targets.anos, targets.pecas, targets.clientes);
        return;
      }
      const t0 = performance.now();
      const D = 1500;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / D);
        const e = 1 - Math.pow(1 - k, 3);
        render(
          Math.round(targets.anos * e),
          Math.round(targets.pecas * e),
          Math.round(targets.clientes * e)
        );
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        animate();
        io.disconnect();
      }
    }, { threshold: 0.3 });
    io.observe(numeros);
  }
});
