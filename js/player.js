/* ============================================================
   Tuck Kids Smart Player — player de VSL próprio (estilo VTurb)
   Montado na região [data-tk-vsl] quando __TK.vsl.videoUrl existe.

   Recursos:
   - Smart Autoplay: inicia mudo + overlay "clique para ativar o som";
     o clique reinicia do zero com som (padrão VSL)
   - Barra de progresso inteligente: acelerada no início (curva
     1-(1-t)^2.5) e sem seek — não dá para arrastar/pular
   - Retomar: posição salva; ao voltar, "Continuar assistindo?"
   - CTA no pitch: botão de WhatsApp aparece após N segundos
   - Eventos de audiência: vsl_play / vsl_unmute / vsl_25/50/75 /
     vsl_complete / vsl_pitch no Pixel, GA4 e dataLayer
   ============================================================ */
(function () {
  'use strict';

  const TK = window.__TK;
  const vsl = TK && TK.vsl;
  if (!vsl || !vsl.videoUrl) return;

  const CORAL = '#FF6655', NAVY = '#101B4D', CREAM = '#FBF7EF';

  function track(nome) {
    try {
      if (window.dataLayer) window.dataLayer.push({ event: nome });
      if (typeof gtag === 'function') gtag('event', nome, { event_category: 'vsl' });
      if (typeof fbq === 'function') fbq('trackCustom', nome);
      if (window.ttq && window.ttq.track) window.ttq.track(nome);
    } catch (_) { /* rastreamento nunca quebra o player */ }
  }

  // chave de armazenamento por vídeo (trocou o vídeo -> zera posição)
  function storeKey() {
    let h = 0;
    for (let i = 0; i < vsl.videoUrl.length; i++) h = (h * 31 + vsl.videoUrl.charCodeAt(i)) >>> 0;
    return 'tk_vsl_' + h.toString(36);
  }
  const KEY = storeKey();
  function saved(campo) {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}')[campo]; } catch (_) { return undefined; }
  }
  function save(campo, val) {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || '{}');
      d[campo] = val;
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch (_) {}
  }

  function waHref() {
    if (typeof waLink === 'function') return waLink('catalogo');
    const num = String((TK.config || {}).whatsappNumber || '').replace(/\D/g, '');
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent('Olá! Quero receber o catálogo Tuck Kids.');
  }

  function mount() {
    const box = document.querySelector('[data-tk-vsl]');
    if (!box || box.dataset.tkPlayerOn) return;
    box.dataset.tkPlayerOn = '1';

    const poster = (box.querySelector('img') || {}).src || '';
    box.innerHTML = '';
    box.style.cursor = 'pointer';

    const style = document.createElement('style');
    style.textContent = `
      @keyframes tkp-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      @keyframes tkp-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      .tkp-ov { position: absolute; inset: 0; display: grid; place-items: center; z-index: 5;
        background: rgba(16,27,77,.45); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); }
      .tkp-card { background: ${CORAL}; color: #fff; border: 0; border-radius: 999px; cursor: pointer;
        font: 700 clamp(14px,2vw,17px)/1.3 'Nunito Sans', -apple-system, sans-serif; padding: 16px 30px;
        display: inline-flex; align-items: center; gap: 12px; box-shadow: 0 14px 40px rgba(0,0,0,.4);
        animation: tkp-pulse 1.6s ease-in-out infinite; }
      .tkp-sub { margin-top: 12px; color: ${CREAM}; font: 700 13px 'Nunito Sans', sans-serif; opacity: .85; }
      .tkp-btn2 { background: rgba(251,247,239,.14); color: ${CREAM}; border: 1.5px solid rgba(251,247,239,.4);
        border-radius: 999px; cursor: pointer; font: 700 14px 'Nunito Sans', sans-serif; padding: 12px 22px; }
      .tkp-cta { display: inline-flex; align-items: center; gap: 10px; background: ${CORAL}; color: #fff !important;
        font: 600 clamp(15px,2vw,18px) 'Poppins','Baloo 2',sans-serif; padding: 16px 34px; border-radius: 999px;
        box-shadow: 0 10px 28px rgba(255,102,85,.4); animation: tkp-in .5s ease both, tkp-pulse 2s ease-in-out .5s infinite; }
    `;
    document.head.appendChild(style);

    // vídeo
    const video = document.createElement('video');
    video.src = vsl.videoUrl;
    if (poster) video.poster = poster;
    video.playsInline = true;
    video.preload = 'metadata';
    video.disablePictureInPicture = true;
    video.setAttribute('controlsList', 'nodownload noplaybackrate');
    video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;background:#000';
    video.addEventListener('contextmenu', (e) => e.preventDefault());
    box.appendChild(video);

    // barra de progresso inteligente (sem seek)
    const barWrap = document.createElement('div');
    barWrap.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:7px;background:rgba(255,255,255,.28);z-index:6;pointer-events:none';
    const bar = document.createElement('div');
    bar.style.cssText = `height:100%;width:0%;background:${CORAL};transition:width .25s linear`;
    barWrap.appendChild(bar);
    box.appendChild(barWrap);

    // overlays
    function overlay(html) {
      const ov = document.createElement('div');
      ov.className = 'tkp-ov';
      ov.innerHTML = html;
      box.appendChild(ov);
      return ov;
    }
    function clearOverlays() {
      box.querySelectorAll('.tkp-ov').forEach((o) => o.remove());
    }

    // CTA do pitch (fica fora da moldura, logo abaixo)
    const pitchS = parseInt(vsl.pitchSegundos || '', 10);
    let ctaEl = null;
    function showCta() {
      if (!pitchS || ctaEl) return;
      ctaEl = document.createElement('div');
      ctaEl.style.cssText = 'text-align:center;margin-top:22px';
      const a = document.createElement('a');
      a.className = 'tkp-cta';
      a.href = waHref();
      a.target = '_blank';
      a.rel = 'noopener';
      a.dataset.wa = 'catalogo';
      a.textContent = vsl.ctaTexto || 'Quero o catálogo agora';
      ctaEl.appendChild(a);
      box.parentElement.insertBefore(ctaEl, box.nextSibling);
      save('pitch', 1);
    }
    if (pitchS && saved('pitch')) showCta(); // quem já viu o pitch mantém o botão

    // ---------- máquina de estados ----------
    let ativo = false;        // já está tocando com som
    const marcos = { 25: false, 50: false, 75: false };
    let pitchDone = !!saved('pitch');

    function play() { video.play().catch(() => {}); }

    function ativar(from) {
      clearOverlays();
      video.muted = false;
      video.currentTime = from || 0;
      ativo = true;
      play();
      track(from ? 'vsl_resume' : 'vsl_unmute');
    }

    function overlaySom() {
      const ov = overlay(
        `<div style="text-align:center"><button class="tkp-card" type="button">🔊&nbsp; Seu vídeo já começou<br>Clique para ativar o som</button></div>`
      );
      ov.addEventListener('click', () => ativar(0));
    }

    function overlayPlay() {
      const ov = overlay(
        `<div style="text-align:center"><button class="tkp-card" type="button" style="animation:none;border-radius:50%;width:92px;height:92px;padding:0;font-size:34px">▶</button></div>`
      );
      ov.addEventListener('click', () => ativar(0));
    }

    function overlayRetomar(pos) {
      const ov = overlay(
        `<div style="text-align:center">
          <button class="tkp-card" type="button" data-acao="continuar">▶&nbsp; Continuar assistindo</button>
          <div class="tkp-sub"><button class="tkp-btn2" type="button" data-acao="recomecar">Recomeçar do início</button></div>
        </div>`
      );
      ov.querySelector('[data-acao="continuar"]').addEventListener('click', (e) => { e.stopPropagation(); ativar(pos); });
      ov.querySelector('[data-acao="recomecar"]').addEventListener('click', (e) => { e.stopPropagation(); ativar(0); });
    }

    function overlayPausa() {
      const ov = overlay(
        `<div style="text-align:center"><button class="tkp-card" type="button" style="animation:none">▶&nbsp; Continuar assistindo</button></div>`
      );
      ov.addEventListener('click', (e) => { e.stopPropagation(); clearOverlays(); play(); });
    }

    // clique no vídeo (fora de overlays): pausa/retoma
    video.addEventListener('click', () => {
      if (!ativo) return;
      if (video.paused) { clearOverlays(); play(); }
      else { video.pause(); overlayPausa(); }
    });

    // progresso + marcos + pitch + posição
    let lastSave = 0;
    video.addEventListener('timeupdate', () => {
      const d = video.duration;
      if (!d) return;
      const t = video.currentTime / d;
      bar.style.width = ((1 - Math.pow(1 - t, 2.5)) * 100).toFixed(2) + '%';
      if (ativo) {
        for (const m of [25, 50, 75]) {
          if (!marcos[m] && t * 100 >= m) { marcos[m] = true; track('vsl_' + m); }
        }
        if (pitchS && !pitchDone && video.currentTime >= pitchS) { pitchDone = true; showCta(); track('vsl_pitch'); }
        if (video.currentTime - lastSave > 2) { lastSave = video.currentTime; save('pos', Math.floor(video.currentTime)); }
      }
    });
    // Fim do vídeo (padrão VTurb/ThumbSniper): nada de tela preta —
    // exibe a capa com o CTA em destaque + opção de rever
    function overlayFinal() {
      clearOverlays();
      const ov = overlay(
        `${poster ? `<div style="position:absolute;inset:0;background:url('${poster}') center/cover no-repeat"></div>` : ''}
        <div style="position:absolute;inset:0;background:rgba(16,27,77,.75)"></div>
        <div style="position:relative;text-align:center;z-index:2;padding:20px">
          <a class="tkp-cta" href="${waHref()}" data-wa="catalogo" target="_blank" rel="noopener">${(vsl.ctaTexto || 'Quero o catálogo agora').replace(/[<>]/g, '')}</a>
          <div class="tkp-sub"><button class="tkp-btn2" type="button" data-acao="replay">↺&nbsp; Assistir novamente</button></div>
        </div>`
      );
      ov.querySelector('[data-acao="replay"]').addEventListener('click', (e) => {
        e.stopPropagation();
        track('vsl_replay');
        ativar(0);
      });
    }

    video.addEventListener('ended', () => {
      if (ativo) track('vsl_complete');
      save('pos', 0);
      bar.style.width = '100%';
      overlayFinal();
    });

    // ---------- início ----------
    track('vsl_view');
    const pos = Number(saved('pos') || 0);
    if (pos > 10) {
      overlayRetomar(pos);
    } else if ((vsl.autoplay || 'on') === 'on') {
      video.muted = true;
      video.play().then(() => { overlaySom(); track('vsl_play'); }).catch(() => overlayPlay());
    } else {
      overlayPlay();
    }
  }

  function boot() {
    // tela "Em breve" ativa: o player só monta quando o site for liberado
    if (document.getElementById('tk-launch')) {
      document.addEventListener('tk:unlock', mount, { once: true });
      return;
    }
    mount();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0)); // após o cms montar o gate
  } else {
    setTimeout(boot, 0);
  }
})();
