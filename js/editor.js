/* ============================================================
   Tuck Kids — Editor inline (injetado apenas para admin autenticado)
   Clique num texto para editar; clique numa imagem para trocar.
   "Salvar" grava os overrides via PUT /api/content.
   ============================================================ */
(function () {
  'use strict';
  const TK = window.__TK;
  if (!TK || !TK.authed) return;

  const keyFor = window.__TK_keyFor;
  const pending = { textos: {}, imagens: {}, config: {}, tracking: {}, secoes: {}, vsl: {} };
  const NAVY = '#101B4D', CORAL = '#FF6655', CREAM = '#FBF7EF';

  // ---------- estilos do editor ----------
  const style = document.createElement('style');
  style.textContent = `
    .tk-editable-hover { outline: 2px dashed ${CORAL} !important; outline-offset: 2px; cursor: pointer; }
    .tk-editing { outline: 2px solid ${CORAL} !important; outline-offset: 2px; background: rgba(255,102,85,.06); }
    .tk-img-hover { outline: 3px dashed ${CORAL} !important; outline-offset: -3px; cursor: pointer; filter: brightness(.92); }
    #tk-toolbar { position: fixed; top: 0; left: 0; right: 0; z-index: 100000; background: ${NAVY}; color: ${CREAM};
      display: flex; align-items: center; gap: 12px; padding: 8px 16px; font: 700 13.5px/1 'Nunito Sans', -apple-system, sans-serif;
      box-shadow: 0 4px 16px rgba(16,27,77,.35); }
    #tk-toolbar .tk-grow { flex: 1; font-weight: 600; opacity: .85; }
    #tk-toolbar button { border: 0; border-radius: 999px; padding: 9px 16px; font: 700 13px 'Nunito Sans', sans-serif; cursor: pointer; }
    #tk-btn-save { background: ${CORAL}; color: #fff; }
    #tk-btn-save:disabled { opacity: .45; cursor: default; }
    #tk-btn-cfg { background: rgba(251,247,239,.15); color: ${CREAM}; }
    #tk-btn-exit { background: transparent; color: rgba(251,247,239,.7); }
    #tk-panel { position: fixed; top: 46px; right: 0; bottom: 0; width: min(380px, 100vw); z-index: 99999; background: #fff;
      box-shadow: -8px 0 30px rgba(16,27,77,.2); padding: 20px 22px 40px; overflow-y: auto; display: none;
      font: 600 14px 'Nunito Sans', sans-serif; color: ${NAVY}; }
    #tk-panel.open { display: block; }
    #tk-panel h3 { font: 700 16px 'Nunito Sans', sans-serif; margin: 22px 0 10px; }
    #tk-panel h3:first-child { margin-top: 0; }
    #tk-panel label { display: block; font-size: 12.5px; font-weight: 800; margin: 12px 0 4px; color: rgba(16,27,77,.65); }
    #tk-panel input, #tk-panel select { width: 100%; border: 1.5px solid rgba(16,27,77,.2); border-radius: 10px;
      padding: 9px 12px; font: 600 14px 'Nunito Sans', sans-serif; color: ${NAVY}; box-sizing: border-box; }
    #tk-panel small { display: block; color: rgba(16,27,77,.5); font-size: 11.5px; margin-top: 3px; }
    #tk-panel .tk-help { margin: 4px 0 6px; padding: 10px 12px; background: #F6F4EF; border-radius: 10px;
      font-size: 12.5px; font-weight: 600; color: rgba(16,27,77,.65); line-height: 1.5; }
    section[data-tk-oculta] { position: relative; opacity: .35; outline: 3px dashed #7778B7; outline-offset: -3px; }
    section[data-tk-oculta]::before { content: '🙈 Seção oculta no site publicado'; position: absolute; top: 10px; left: 50%;
      transform: translateX(-50%); z-index: 30; background: #7778B7; color: #fff; font: 700 12.5px 'Nunito Sans', sans-serif;
      padding: 7px 16px; border-radius: 999px; white-space: nowrap; }
    #tk-toast { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); z-index: 100001; background: ${NAVY};
      color: ${CREAM}; border-radius: 999px; padding: 12px 22px; font: 700 14px 'Nunito Sans', sans-serif; display: none; }
  `;
  document.head.appendChild(style);

  // Empurra a página para baixo da barra e ajusta o header sticky
  const BAR = 46;
  document.body.style.paddingTop = BAR + 'px';
  const header = document.querySelector('header');
  if (header) header.style.top = BAR + 'px';

  // ---------- barra superior ----------
  const isAdmin = TK.user && TK.user.role === 'admin';
  const bar = document.createElement('div');
  bar.id = 'tk-toolbar';
  bar.innerHTML = `
    <span>✏️ ${TK.user ? TK.user.nome : 'Edição'}</span>
    <span>· Layout
      ${['v1','v2','v3'].map((l) => l === TK.layout
        ? `<b style="color:#FFB52E">${l.toUpperCase()}</b>`
        : `<a href="/painel/${l}" style="color:#FBF7EF;text-decoration:underline">${l.toUpperCase()}</a>`).join(' ')}
    </span>
    <span class="tk-grow">clique num texto para editar · numa imagem para trocar</span>
    ${isAdmin ? '<button id="tk-btn-users" type="button">👥 Usuários</button><button id="tk-btn-log" type="button">📜 Histórico</button>' : ''}
    <button id="tk-btn-sec" type="button">🧩 Seções</button>
    <button id="tk-btn-cfg" type="button">⚙️ Configurações</button>
    <button id="tk-btn-pub" type="button">🚀 Publicar</button>
    <button id="tk-btn-save" type="button" disabled>💾 Salvar</button>
    <button id="tk-btn-exit" type="button">Sair</button>`;
  document.body.appendChild(bar);

  const toast = document.createElement('div');
  toast.id = 'tk-toast';
  document.body.appendChild(toast);
  function showToast(msg, ms) {
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => { toast.style.display = 'none'; }, ms || 2400);
  }

  const btnSave = bar.querySelector('#tk-btn-save');
  function pendingCount() {
    return Object.keys(pending.textos).length + Object.keys(pending.imagens).length +
      Object.keys(pending.config).length + Object.keys(pending.tracking).length +
      Object.keys(pending.secoes).length + Object.keys(pending.vsl).length;
  }
  function refreshSave() {
    const n = pendingCount();
    btnSave.disabled = n === 0;
    btnSave.textContent = n ? `💾 Salvar (${n})` : '💾 Salvar';
  }

  function inEditorUI(el) {
    return el.closest && (el.closest('#tk-toolbar') || el.closest('#tk-panel') || el.closest('#tk-upanel') || el.closest('#tk-lpanel') || el.closest('#tk-spanel') || el.closest('.ver-switch'));
  }

  // ---------- edição de texto ----------
  const INLINE_OK = new Set(['STRONG', 'EM', 'B', 'I', 'SPAN', 'BR', 'SMALL', 'SUP', 'SUB']);
  function isEditableText(el) {
    if (!el || inEditorUI(el) || el.tagName === 'IMG' || el.isContentEditable) return false;
    if (el.id && el.id.startsWith('stat-')) return false; // contadores animados
    if (!el.textContent.trim()) return false;
    for (const child of el.children) {
      if (!INLINE_OK.has(child.tagName)) return false;
    }
    return ['H1', 'H2', 'H3', 'P', 'A', 'DIV', 'SPAN', 'BUTTON', 'LI'].includes(el.tagName);
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target;
    if (el.tagName === 'IMG' && !inEditorUI(el)) { el.classList.add('tk-img-hover'); return; }
    if (isEditableText(el)) el.classList.add('tk-editable-hover');
  });
  document.addEventListener('mouseout', (e) => {
    e.target.classList && (e.target.classList.remove('tk-editable-hover'), e.target.classList.remove('tk-img-hover'));
  });

  document.addEventListener('click', (e) => {
    if (inEditorUI(e.target)) return;

    // Em modo edição, links não navegam
    const link = e.target.closest && e.target.closest('a');
    if (link) { e.preventDefault(); e.stopPropagation(); }

    // troca de imagem
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      pickImage(e.target);
      return;
    }

    // edição de texto
    let el = e.target;
    if (!isEditableText(el) && link && isEditableText(link)) el = link;
    if (!isEditableText(el)) return;
    e.preventDefault();
    e.stopPropagation();
    startEditing(el);
  }, true);

  function startEditing(el) {
    if (el.isContentEditable) return;
    const original = el.innerHTML;
    el.classList.remove('tk-editable-hover');
    el.classList.add('tk-editing');
    el.setAttribute('contenteditable', 'true');
    el.focus();
    const finish = () => {
      el.removeAttribute('contenteditable');
      el.classList.remove('tk-editing');
      el.removeEventListener('blur', finish);
      if (el.innerHTML !== original) {
        pending.textos[keyFor(el)] = el.innerHTML;
        refreshSave();
      }
    };
    el.addEventListener('blur', finish);
  }

  // ---------- troca de imagem ----------
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  let imgTarget = null;

  function pickImage(img) {
    imgTarget = img;
    fileInput.value = '';
    fileInput.click();
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file || !imgTarget) return;
    showToast('Enviando imagem…', 10000);
    const fd = new FormData();
    fd.append('imagem', file);
    try {
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'falha no upload');
      const key = imgTarget.dataset.tkKey || imgTarget.getAttribute('src');
      imgTarget.dataset.tkKey = key;
      imgTarget.setAttribute('src', j.path);
      pending.imagens[key] = j.path;
      refreshSave();
      showToast('Imagem trocada — não esqueça de salvar');
    } catch (err) {
      showToast('Erro: ' + err.message);
    }
  });

  // ---------- painel de configurações ----------
  const CFG_FIELDS = [
    ['h3', 'Site'],
    ['help', 'Configurações gerais. Tudo que você salvar aqui vale para o site publicado após a próxima publicação.'],
    ['select', 'config.layoutAtivo', 'Layout ativo (página inicial)', ['v1', 'v2', 'v3']],
    ['select', 'config.modoLancamento', 'Modo lançamento — "on" mostra só a tela "Em breve" com senha; "off" abre o site ao público', ['on', 'off']],
    ['input', 'config.whatsappNumber', 'WhatsApp (55 + DDD + número)', 'ex.: 5547999999999'],
    ['input', 'config.pedidoMinimo', 'Pedido mínimo (frete grátis)', 'ex.: R$ 2.000'],
    ['input', 'config.instagram', 'Link do Instagram', 'https://instagram.com/...'],
    ['input', 'config.facebook', 'Link do Facebook', 'https://facebook.com/...'],
    ['h3', '🎬 Vídeo — "Conheça a Tuck Kids"'],
    ['help', 'Player inteligente estilo VSL: o vídeo começa sozinho e sem som ("clique para ativar o som"), a barra de progresso corre acelerada no início, não dá para arrastar/pular, quem sai e volta pode continuar de onde parou, e um botão de WhatsApp pode aparecer no momento do pitch. Envie um arquivo .mp4 ou cole a URL. Vazio = a seção continua com a imagem atual.'],
    ['video-upload', 'vsl.videoUrl', '📤 Enviar vídeo (desktop · 16:9)'],
    ['input', 'vsl.videoUrl', 'URL do vídeo — desktop (.mp4/.webm)', 'preenchida automaticamente ao enviar'],
    ['video-upload', 'vsl.videoUrlMobile', '📱 Enviar vídeo do celular (vertical · 9:16)'],
    ['input', 'vsl.videoUrlMobile', 'URL do vídeo — celular (opcional)', 'vazio = celular usa o mesmo vídeo do desktop'],
    ['select', 'vsl.autoplay', 'Começar sozinho, sem som (Smart Autoplay)', ['on', 'off']],
    ['input', 'vsl.pitchSegundos', 'Liberar botão de WhatsApp após (segundos)', 'vazio = não mostrar o botão'],
    ['input', 'vsl.ctaTexto', 'Texto do botão do pitch', 'ex.: Quero o catálogo agora'],
    ['h3', 'Rastreamento e anúncios'],
    ['help', 'Cole os IDs fornecidos pelas plataformas. Com eles preenchidos, os códigos de medição são instalados sozinhos no site e cada clique nos botões de WhatsApp é contado como conversão (evento Contact/generate_lead).'],
    ['input', 'tracking.metaPixelId', 'Meta Pixel ID (Facebook/Instagram Ads)', 'somente números'],
    ['input', 'tracking.ga4Id', 'Google Analytics 4 (G-XXXXXXX)', ''],
    ['input', 'tracking.gtmId', 'Google Tag Manager (GTM-XXXXXX) — opcional', ''],
    ['input', 'tracking.tiktokPixelId', 'TikTok Pixel ID — opcional', ''],
    ['h3', 'Verificação de domínio'],
    ['help', 'Códigos que o Google (Search Console) e o Meta (Business Manager) pedem para provar que o site é seu. Cole apenas o valor "content" da meta tag que eles mostram.'],
    ['input', 'tracking.googleSiteVerification', 'Google Search Console (content da meta tag)', ''],
    ['input', 'tracking.facebookDomainVerification', 'Meta domain verification (content da meta tag)', ''],
    ['h3', 'Compartilhamento'],
    ['help', 'A imagem do "cartãozinho" de prévia que aparece quando alguém cola o link do site no WhatsApp, Instagram ou Facebook. Deixe vazio para usar o cartão padrão com a logo e o slogan. Para usar outra, cole a URL de uma imagem de 1200×630.'],
    ['input', 'tracking.ogImage', 'Imagem de compartilhamento — opcional', 'vazio = cartão padrão com a logo'],
  ];

  const panel = document.createElement('div');
  panel.id = 'tk-panel';
  panel.innerHTML = CFG_FIELDS.map(([kind, a, b, c]) => {
    if (kind === 'h3') return `<h3>${a}</h3>`;
    if (kind === 'help') return `<p class="tk-help">${a}</p>`;
    if (kind === 'video-upload') {
      const uid = a.replace('.', '-');
      return `<div style="display:flex;align-items:center;gap:10px;margin:10px 0 4px">
        <button type="button" class="tk-video-btn" data-target="${a}" style="border:0;border-radius:999px;padding:10px 18px;background:#4F9993;color:#fff;font:700 13.5px 'Nunito Sans',sans-serif;cursor:pointer">${b}</button>
        <span id="tk-video-status-${uid}" style="font-size:12.5px;font-weight:700;color:rgba(16,27,77,.55)"></span>
        <input type="file" class="tk-video-file" data-target="${a}" accept="video/mp4,video/webm" style="display:none"></div>`;
    }
    const id = 'tk-f-' + a.replace('.', '-');
    if (kind === 'select') {
      return `<label for="${id}">${b}</label><select id="${id}" data-path="${a}">${c.map((o) => `<option>${o}</option>`).join('')}</select>`;
    }
    return `<label for="${id}">${b}</label><input id="${id}" data-path="${a}" placeholder="${c || ''}">` +
      (c ? `<small>${c}</small>` : '');
  }).join('');
  document.body.appendChild(panel);

  // upload de vídeo: client upload direto ao Blob (produção) ou multipart (dev)
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.tk-video-btn');
    if (btn) panel.querySelector(`.tk-video-file[data-target="${btn.dataset.target}"]`).click();
  });
  panel.addEventListener('change', async (e) => {
    if (!e.target || !e.target.classList || !e.target.classList.contains('tk-video-file')) return;
    const alvo = e.target.dataset.target;               // ex.: vsl.videoUrlMobile
    const chave = alvo.split('.')[1];
    const file = e.target.files[0];
    if (!file) return;
    const status = panel.querySelector('#tk-video-status-' + alvo.replace('.', '-'));
    const setUrl = (url) => {
      const campo = panel.querySelector('#tk-f-' + alvo.replace('.', '-'));
      campo.value = url;
      pending.vsl[chave] = url;
      refreshSave();
      status.textContent = '✅ vídeo pronto — clique em Salvar';
    };
    try {
      status.textContent = 'preparando…';
      const { mode } = await (await fetch('/api/video-upload')).json();
      if (mode === 'blob') {
        const { upload } = await import('https://esm.sh/@vercel/blob@0.27.3/client');
        const blob = await upload('tk/videos/' + file.name.replace(/[^\w.-]+/g, '_'), file, {
          access: 'public',
          handleUploadUrl: '/api/video-upload',
          contentType: file.type,
          onUploadProgress: (p) => { status.textContent = 'enviando… ' + Math.round((p && p.percentage) || 0) + '%'; },
        });
        setUrl(blob.url);
      } else {
        status.textContent = 'enviando…';
        const fd = new FormData();
        fd.append('video', file);
        const r = await fetch('/api/video-upload', { method: 'POST', body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'falha no upload');
        setUrl(j.url);
      }
    } catch (err) {
      status.textContent = '❌ ' + err.message;
    }
  });

  let cfgLoaded = false;
  async function openPanel() {
    if (!cfgLoaded) {
      const r = await fetch('/api/content');
      const content = await r.json();
      panel.querySelectorAll('[data-path]').forEach((f) => {
        const [group, key] = f.dataset.path.split('.');
        f.value = (content[group] && content[group][key]) || '';
      });
      cfgLoaded = true;
    }
    panel.classList.add('open');
  }

  panel.addEventListener('change', (e) => {
    const f = e.target;
    if (!f.dataset.path) return;
    const [group, key] = f.dataset.path.split('.');
    pending[group][key] = f.value;
    refreshSave();
  });

  bar.querySelector('#tk-btn-cfg').addEventListener('click', () => {
    upanel.style.display = 'none';
    lpanel.style.display = 'none';
    spanel.style.display = 'none';
    if (panel.classList.contains('open')) panel.classList.remove('open');
    else openPanel();
  });

  // ---------- salvar / sair ----------
  btnSave.addEventListener('click', async () => {
    const patch = {};
    if (Object.keys(pending.textos).length) patch.textos = { [TK.layout]: pending.textos };
    if (Object.keys(pending.imagens).length) patch.imagens = pending.imagens;
    if (Object.keys(pending.secoes).length) patch.secoes = { [TK.layout]: pending.secoes };
    if (Object.keys(pending.vsl).length) patch.vsl = pending.vsl;
    if (Object.keys(pending.config).length) patch.config = pending.config;
    if (Object.keys(pending.tracking).length) patch.tracking = pending.tracking;
    btnSave.disabled = true;
    btnSave.textContent = 'Salvando…';
    try {
      const r = await fetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'erro ao salvar');
      showToast(j.publicando ? '✅ Salvo! Publicando o site (~1 min)…' : '✅ Alterações salvas!');
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      showToast('Erro: ' + err.message);
      refreshSave();
    }
  });

  // ---------- painel de seções (dobras) ----------
  const spanel = document.createElement('div');
  spanel.id = 'tk-spanel';
  spanel.style.cssText = 'position:fixed;top:46px;right:0;bottom:0;width:min(380px,100vw);z-index:99999;background:#fff;box-shadow:-8px 0 30px rgba(16,27,77,.2);padding:20px 22px 40px;overflow-y:auto;display:none;font:600 14px Nunito Sans,sans-serif;color:#101B4D';
  document.body.appendChild(spanel);

  function nomeSecao(sec, i) {
    const t = sec.querySelector('h1, h2, h3');
    let txt = t ? t.textContent.trim().replace(/\s+/g, ' ') : '';
    if (!txt && sec.id) txt = sec.id.charAt(0).toUpperCase() + sec.id.slice(1).replace(/-/g, ' ');
    return txt ? (txt.length > 42 ? txt.slice(0, 42) + '…' : txt) : ('Seção ' + (i + 1));
  }

  function renderSecoes() {
    const secs = Array.from(document.querySelectorAll('main > section'));
    spanel.innerHTML = '<h3 style="font:700 16px Nunito Sans,sans-serif;margin:0 0 6px">🧩 Seções do layout ' + TK.layout.toUpperCase() + '</h3>' +
      '<p style="margin:0 0 14px;padding:10px 12px;background:#F6F4EF;border-radius:10px;font-size:12.5px;color:rgba(16,27,77,.65);line-height:1.5">Desmarque para ocultar a seção do site publicado. No modo edição ela continua visível, esmaecida. Lembre de salvar.</p>' +
      secs.map((sec, i) => {
        const key = sec.dataset.tkSecao || sec.id || ('sec' + i);
        const oculta = sec.dataset.tkOculta === '1';
        return '<label style="display:flex;align-items:center;gap:10px;border:1.5px solid rgba(16,27,77,.12);border-radius:12px;padding:11px 14px;margin-bottom:8px;cursor:pointer">' +
          '<input type="checkbox" data-sec="' + key + '" ' + (oculta ? '' : 'checked') + ' style="width:17px;height:17px;accent-color:#4F9993">' +
          '<span style="flex:1">' + nomeSecao(sec, i) + '</span>' +
          '<small style="color:rgba(16,27,77,.4)">' + key + '</small></label>';
      }).join('');
    spanel.querySelectorAll('input[data-sec]').forEach((cb) => cb.addEventListener('change', () => {
      const key = cb.dataset.sec;
      const sec = document.querySelector('main > section[data-tk-secao="' + key + '"]');
      if (cb.checked) {
        pending.secoes[key] = null; // null = volta a exibir
        if (sec) delete sec.dataset.tkOculta;
      } else {
        pending.secoes[key] = false;
        if (sec) sec.dataset.tkOculta = '1';
      }
      refreshSave();
    }));
  }

  bar.querySelector('#tk-btn-sec').addEventListener('click', () => {
    panel.classList.remove('open');
    if (typeof upanel !== 'undefined') upanel.style.display = 'none';
    if (typeof lpanel !== 'undefined') lpanel.style.display = 'none';
    const aberto = spanel.style.display === 'block';
    spanel.style.display = aberto ? 'none' : 'block';
    if (!aberto) renderSecoes();
  });

  bar.querySelector('#tk-btn-pub').addEventListener('click', async () => {
    const r = await fetch('/api/publish', { method: 'POST' });
    const j = await r.json();
    showToast(j.publicando ? '🚀 Publicação disparada (~1 min)' : 'Publicação automática não configurada (DEPLOY_HOOK_URL)');
  });

  // ---------- painel de usuários (admin) ----------
  const upanel = document.createElement('div');
  upanel.id = 'tk-upanel';
  upanel.style.cssText = 'position:fixed;top:46px;right:0;bottom:0;width:min(420px,100vw);z-index:99999;background:#fff;box-shadow:-8px 0 30px rgba(16,27,77,.2);padding:20px 22px 40px;overflow-y:auto;display:none;font:600 14px Nunito Sans,sans-serif;color:#101B4D';
  document.body.appendChild(upanel);

  async function renderUsers() {
    const users = await (await fetch('/api/users')).json();
    upanel.innerHTML = `
      <h3 style="font:700 16px 'Nunito Sans',sans-serif;margin:0 0 14px">👥 Usuários</h3>
      ${users.map((u) => `
        <div style="border:1.5px solid rgba(16,27,77,.12);border-radius:14px;padding:12px 14px;margin-bottom:10px;${u.ativo ? '' : 'opacity:.5'}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div><b>${u.nome}</b> <small style="color:rgba(16,27,77,.5)">@${u.login}</small><br>
            <small style="color:${u.role === 'admin' ? '#FF6655' : '#4F9993'};font-weight:800">${u.role === 'admin' ? 'Administrador' : 'Editor'}</small>
            ${u.ativo ? '' : ' · <small style="font-weight:800">desativado</small>'}</div>
            <div style="display:flex;gap:6px">
              <button data-acao="senha" data-id="${u.id}" title="Redefinir senha" style="border:0;background:#EDF4F3;border-radius:8px;padding:6px 9px;cursor:pointer">🔑</button>
              <button data-acao="ativo" data-id="${u.id}" data-v="${!u.ativo}" title="${u.ativo ? 'Desativar' : 'Reativar'}" style="border:0;background:#FDF0EA;border-radius:8px;padding:6px 9px;cursor:pointer">${u.ativo ? '🚫' : '✅'}</button>
            </div>
          </div>
        </div>`).join('')}
      <h3 style="font:700 15px 'Nunito Sans',sans-serif;margin:20px 0 10px">Novo usuário (ex.: agência)</h3>
      <input id="tk-u-nome" placeholder="Nome" style="width:100%;border:1.5px solid rgba(16,27,77,.2);border-radius:10px;padding:9px 12px;margin-bottom:8px;box-sizing:border-box">
      <input id="tk-u-login" placeholder="Login (ex.: agencia)" style="width:100%;border:1.5px solid rgba(16,27,77,.2);border-radius:10px;padding:9px 12px;margin-bottom:8px;box-sizing:border-box">
      <input id="tk-u-senha" type="password" placeholder="Senha (mín. 8 caracteres)" style="width:100%;border:1.5px solid rgba(16,27,77,.2);border-radius:10px;padding:9px 12px;margin-bottom:8px;box-sizing:border-box">
      <select id="tk-u-role" style="width:100%;border:1.5px solid rgba(16,27,77,.2);border-radius:10px;padding:9px 12px;margin-bottom:10px;box-sizing:border-box">
        <option value="editor">Editor — edita conteúdo (para a agência)</option>
        <option value="admin">Administrador — tudo, inclusive usuários</option>
      </select>
      <button id="tk-u-criar" style="width:100%;border:0;border-radius:999px;padding:11px;background:#FF6655;color:#fff;font:700 14px 'Nunito Sans',sans-serif;cursor:pointer">Criar usuário</button>
      <div id="tk-u-erro" style="color:#d0342a;font-weight:700;font-size:13px;min-height:18px;margin-top:8px"></div>`;

    upanel.querySelector('#tk-u-criar').addEventListener('click', async () => {
      const erro = upanel.querySelector('#tk-u-erro');
      const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: upanel.querySelector('#tk-u-nome').value, login: upanel.querySelector('#tk-u-login').value,
          senha: upanel.querySelector('#tk-u-senha').value, role: upanel.querySelector('#tk-u-role').value }) });
      const j = await r.json();
      if (!r.ok) { erro.textContent = j.error; return; }
      showToast('Usuário criado: ' + j.login);
      renderUsers();
    });
    upanel.querySelectorAll('[data-acao]').forEach((btn) => btn.addEventListener('click', async () => {
      const body = btn.dataset.acao === 'senha'
        ? { senha: prompt('Nova senha para este usuário (mín. 8 caracteres):') }
        : { ativo: btn.dataset.v === 'true' };
      if (btn.dataset.acao === 'senha' && !body.senha) return;
      const r = await fetch('/api/users/' + btn.dataset.id, { method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      showToast(r.ok ? 'Usuário atualizado' : 'Erro: ' + j.error);
      renderUsers();
    }));
  }

  // ---------- painel de histórico (admin) ----------
  const lpanel = document.createElement('div');
  lpanel.id = 'tk-lpanel';
  lpanel.style.cssText = upanel.style.cssText;
  document.body.appendChild(lpanel);

  const ACAO_LABEL = { login: '🔓 Entrou', login_falhou: '⛔ Login falhou', conteudo_alterado: '✏️ Alterou conteúdo',
    imagem_enviada: '🖼️ Enviou imagem', usuario_criado: '👥 Criou usuário', usuario_alterado: '👥 Alterou usuário', publicacao: '🚀 Publicação' };
  async function renderLog() {
    const log = await (await fetch('/api/audit')).json();
    lpanel.innerHTML = '<h3 style="font:700 16px Nunito Sans,sans-serif;margin:0 0 14px">📜 Histórico de alterações e acessos</h3>' +
      (log.length ? log.map((e) => `
        <div style="border-bottom:1px solid rgba(16,27,77,.08);padding:9px 2px;font-size:13px">
          <div style="display:flex;justify-content:space-between;gap:8px">
            <b>${ACAO_LABEL[e.acao] || e.acao}</b>
            <small style="color:rgba(16,27,77,.45);white-space:nowrap">${new Date(e.ts).toLocaleString('pt-BR')}</small>
          </div>
          <div style="color:rgba(16,27,77,.65)">${e.usuario}${e.detalhe ? ' · ' + e.detalhe : ''}</div>
        </div>`).join('') : '<p>Nenhum registro ainda.</p>');
  }

  function togglePanel(which) {
    const map = { cfg: panel, users: upanel, log: lpanel };
    for (const [k, p] of Object.entries(map)) {
      if (k === which) p.classList ? p.classList.toggle('open') : null;
      if (k !== which) { p.classList && p.classList.remove('open'); p.style && k !== 'cfg' && (p.style.display = 'none'); }
    }
  }
  if (isAdmin) {
    bar.querySelector('#tk-btn-users').addEventListener('click', () => {
      panel.classList.remove('open'); lpanel.style.display = 'none'; spanel.style.display = 'none';
      const aberto = upanel.style.display === 'block';
      upanel.style.display = aberto ? 'none' : 'block';
      if (!aberto) renderUsers();
    });
    bar.querySelector('#tk-btn-log').addEventListener('click', () => {
      panel.classList.remove('open'); upanel.style.display = 'none'; spanel.style.display = 'none';
      const aberto = lpanel.style.display === 'block';
      lpanel.style.display = aberto ? 'none' : 'block';
      if (!aberto) renderLog();
    });
  }

  bar.querySelector('#tk-btn-exit').addEventListener('click', async () => {
    if (pendingCount() && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    await fetch('/api/logout', { method: 'POST' });
    location.href = '/admin';
  });

  window.addEventListener('beforeunload', (e) => {
    if (pendingCount()) { e.preventDefault(); e.returnValue = ''; }
  });
})();
