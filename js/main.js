/* ============================================================
   Tuck Kids — Landing page
   Configuração + interações (menu, FAQ, contadores, WhatsApp)
   ============================================================ */

// TODO: substituir pelo número oficial de WhatsApp da Tuck Kids (formato: 55 + DDD + número)
const TK_CONFIG = {
  whatsappNumber: '5547999999999',
  pedidoMinimo: 'R$ 2.000',
};

// Uma página pode sobrescrever mensagens definindo window.TK_MSG_OVERRIDES antes deste script
const WA_MESSAGES = Object.assign({
  catalogo: 'Olá! Quero receber o catálogo Tuck Kids.',
  especialista: 'Olá! Quero falar com um especialista da Tuck Kids.',
  video: 'Olá! Quero agendar uma videochamada para conhecer a fábrica da Tuck Kids.',
  representante: 'Olá! Quero ser representante Tuck Kids.',
  conhecer: 'Olá! Quero conhecer a Tuck Kids.',
}, window.TK_MSG_OVERRIDES || {});

function waLink(messageKey) {
  const num = String(TK_CONFIG.whatsappNumber).replace(/\D/g, '');
  const msg = WA_MESSAGES[messageKey] || WA_MESSAGES.catalogo;
  return 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg);
}

document.addEventListener('DOMContentLoaded', () => {
  // Links de WhatsApp — todo <a data-wa="chave">
  document.querySelectorAll('[data-wa]').forEach((el) => {
    el.setAttribute('href', waLink(el.dataset.wa));
  });

  // Pedido mínimo — todo <span data-cfg="pedidoMinimo">
  document.querySelectorAll('[data-cfg="pedidoMinimo"]').forEach((el) => {
    el.textContent = TK_CONFIG.pedidoMinimo;
  });

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
