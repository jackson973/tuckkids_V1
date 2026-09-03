/* ============================================================
   Tuck Kids — Editor inline (injetado apenas para admin autenticado)
   Clique num texto para editar; clique numa imagem para trocar.
   Painéis: 📄 Páginas (clonar/ativar/excluir/principal + teste A/B),
   🎨 Estilo da página, 🧩 Seções, ⚙️ Configurações.
   "Salvar" grava os overrides da página aberta via PUT /api/content.
   ============================================================ */
(function () {
  'use strict';
  const TK = window.__TK;
  if (!TK || !TK.authed) return;

  const keyFor = window.__TK_keyFor;
  const pending = { textos: {}, imagens: {}, secoes: {}, estilo: {}, config: {}, tracking: {}, vsl: {}, origem: {} };
  const NAVY = '#101B4D', CORAL = '#FF6655', CREAM = '#FBF7EF';
  const PANEL_CSS = 'position:fixed;top:46px;right:0;bottom:0;width:min(400px,100vw);z-index:99999;background:#fff;box-shadow:-8px 0 30px rgba(16,27,77,.2);padding:20px 22px 40px;overflow-y:auto;display:none;font:600 14px Nunito Sans,sans-serif;color:#101B4D';

  // ---------- estilos do editor ----------
  const style = document.createElement('style');
  style.textContent = `
    .tk-editable-hover { outline: 2px dashed ${CORAL} !important; outline-offset: 2px; cursor: pointer; }
    .tk-editing { outline: 2px solid ${CORAL} !important; outline-offset: 2px; background: rgba(255,102,85,.06); }
    .tk-img-hover { outline: 3px dashed ${CORAL} !important; outline-offset: -3px; cursor: pointer; filter: brightness(.92); }
    #tk-toolbar { position: fixed; top: 0; left: 0; right: 0; z-index: 100000; background: ${NAVY}; color: ${CREAM};
      display: flex; align-items: center; gap: 10px; padding: 8px 16px; font: 700 13.5px/1 'Nunito Sans', -apple-system, sans-serif;
      box-shadow: 0 4px 16px rgba(16,27,77,.35); }
    #tk-toolbar .tk-grow { flex: 1; font-weight: 600; opacity: .85; }
    #tk-toolbar button { border: 0; border-radius: 999px; padding: 9px 14px; font: 700 13px 'Nunito Sans', sans-serif; cursor: pointer;
      background: rgba(251,247,239,.15); color: ${CREAM}; }
    #tk-btn-save { background: ${CORAL} !important; color: #fff !important; }
    #tk-btn-save:disabled { opacity: .45; cursor: default; }
    #tk-btn-exit { background: transparent !important; color: rgba(251,247,239,.7) !important; }
    .tk-panel { ${PANEL_CSS} }
    .tk-panel.open { display: block; }
    .tk-panel h3 { font: 700 16px 'Nunito Sans', sans-serif; margin: 22px 0 10px; }
    .tk-panel h3:first-child { margin-top: 0; }
    .tk-panel label { display: block; font-size: 12.5px; font-weight: 800; margin: 12px 0 4px; color: rgba(16,27,77,.65); }
    .tk-panel input, .tk-panel select { width: 100%; border: 1.5px solid rgba(16,27,77,.2); border-radius: 10px;
      padding: 9px 12px; font: 600 14px 'Nunito Sans', sans-serif; color: ${NAVY}; box-sizing: border-box; background: #fff; }
    .tk-panel input[type=color] { height: 42px; padding: 4px 6px; cursor: pointer; }
    .tk-panel small { display: block; color: rgba(16,27,77,.5); font-size: 11.5px; margin-top: 3px; }
    .tk-panel .tk-help { margin: 4px 0 6px; padding: 10px 12px; background: #F6F4EF; border-radius: 10px;
      font-size: 12.5px; font-weight: 600; color: rgba(16,27,77,.65); line-height: 1.5; }
    .tk-panel .tk-card { border: 1.5px solid rgba(16,27,77,.12); border-radius: 14px; padding: 12px 14px; margin-bottom: 10px; }
    .tk-panel .tk-card.tk-atual { border-color: #4F9993; box-shadow: 0 0 0 2px rgba(79,153,147,.2); }
    .tk-panel .tk-card.tk-off { opacity: .6; background: #FAFAFA; }
    .tk-panel .tk-tag { display: inline-block; font-size: 11px; font-weight: 800; border-radius: 999px; padding: 3px 9px; margin-left: 4px; }
    .tk-panel .tk-acoes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .tk-panel .tk-acoes button, .tk-panel .tk-btn { border: 0; border-radius: 999px; padding: 7px 12px; font: 700 12.5px 'Nunito Sans', sans-serif;
      cursor: pointer; background: #EDF4F3; color: ${NAVY}; }
    .tk-panel .tk-btn-main { background: ${CORAL}; color: #fff; width: 100%; padding: 11px; font-size: 14px; margin-top: 10px; }
    .tk-panel .tk-btn-danger { background: #FDECEA; color: #b3261e; }
    .tk-panel .tk-erro { color: #d0342a; font-weight: 700; font-size: 13px; min-height: 18px; margin-top: 8px; }
    section[data-tk-oculta] { position: relative; opacity: .35; outline: 3px dashed #7778B7; outline-offset: -3px; }
    section[data-tk-oculta]::before { content: '🙈 Seção oculta no site publicado'; position: absolute; top: 10px; left: 50%;
      transform: translateX(-50%); z-index: 30; background: #7778B7; color: #fff; font: 700 12.5px 'Nunito Sans', sans-serif;
      padding: 7px 16px; border-radius: 999px; white-space: nowrap; }
    #tk-img-dica { position: fixed; z-index: 100002; background: ${NAVY}; color: ${CREAM}; border-radius: 12px; padding: 9px 13px;
      font: 700 12.5px/1.45 'Nunito Sans', sans-serif; box-shadow: 0 8px 24px rgba(16,27,77,.35); pointer-events: none; display: none; max-width: 320px; }
    #tk-img-dica b { color: #FFB52E; }
    #tk-img-dica small { display: block; font-weight: 600; opacity: .8; font-size: 11.5px; margin-top: 3px; }
    #tk-toast { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); z-index: 100001; background: ${NAVY};
      color: ${CREAM}; border-radius: 999px; padding: 12px 22px; font: 700 14px 'Nunito Sans', sans-serif; display: none; }
  `;
  document.head.appendChild(style);

  // Empurra a página para baixo da barra e ajusta o header sticky
  const BAR = 46;
  document.body.style.paddingTop = BAR + 'px';
  const header = document.querySelector('header');
  if (header) header.style.top = BAR + 'px';

  const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- barra superior ----------
  const isAdmin = TK.user && TK.user.role === 'admin';
  const bar = document.createElement('div');
  bar.id = 'tk-toolbar';
  bar.innerHTML = `
    <span>✏️ ${escHtml(TK.user ? TK.user.nome : 'Edição')}</span>
    <span>· <b style="color:#FFB52E">${escHtml(TK.nomePagina || TK.pagina)}</b> <span style="opacity:.6">(${TK.pagina})</span></span>
    <span class="tk-grow">clique num texto para editar · numa imagem para trocar</span>
    ${isAdmin ? '<button id="tk-btn-users" type="button">👥 Usuários</button><button id="tk-btn-log" type="button">📜 Histórico</button>' : ''}
    <button id="tk-btn-pages" type="button">📄 Páginas</button>
    <button id="tk-btn-style" type="button">🎨 Estilo</button>
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
    return Object.values(pending).reduce((n, g) => n + Object.keys(g).length, 0);
  }
  function refreshSave() {
    const n = pendingCount();
    btnSave.disabled = n === 0;
    btnSave.textContent = n ? `💾 Salvar (${n})` : '💾 Salvar';
  }

  // ---------- painéis laterais (um aberto por vez) ----------
  const panels = {};
  function criarPanel(id) {
    const el = document.createElement('div');
    el.id = id;
    el.className = 'tk-panel';
    document.body.appendChild(el);
    panels[id] = el;
    return el;
  }
  function togglePanel(id, onOpen) {
    const abrir = !panels[id].classList.contains('open');
    Object.values(panels).forEach((p) => p.classList.remove('open'));
    if (abrir) { panels[id].classList.add('open'); if (onOpen) onOpen(); }
  }
  function inEditorUI(el) {
    return el.closest && (el.closest('#tk-toolbar') || el.closest('.tk-panel'));
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

  // ---------- dica de tamanho ideal da imagem ----------
  // O espaço de cada foto é fixo no layout; a imagem enviada é encaixada nele
  // (img-cover corta as sobras, img-contain mostra inteira). A dica mostra o
  // tamanho/proporção do espaço, em pixels dobrados (nitidez em telas retina).
  const dica = document.createElement('div');
  dica.id = 'tk-img-dica';
  document.body.appendChild(dica);

  const PROPORCOES = [[16, 9], [16, 10], [4, 3], [3, 2], [1, 1], [4, 5], [3, 4], [2, 3], [9, 16], [21, 9], [5, 4], [2, 1], [3, 1]];
  function proporcaoDe(w, h) {
    const r = w / h;
    let melhor = null;
    for (const [a, b] of PROPORCOES) {
      const d = Math.abs(a / b - r) / r;
      if (d < 0.04 && (!melhor || d < melhor.d)) melhor = { a, b, d };
    }
    return melhor ? `${melhor.a}:${melhor.b}` : `${(r).toFixed(2)}:1`;
  }
  function infoImagem(img) {
    const r = img.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) return null;
    const contain = img.classList.contains('img-contain');
    const livre = !img.classList.contains('img-cover') && !contain;
    const autoW = livre && img.style.height === 'auto';   // ex.: banner (largura total, altura acompanha a foto)
    const autoH = livre && !autoW;                          // ex.: logo (altura fixa, largura livre)
    return { w, h, ideal: [w * 2, h * 2], proporcao: proporcaoDe(w, h), contain, autoH, autoW };
  }
  function mostrarDica(img) {
    const i = infoImagem(img);
    if (!i) return;
    dica.innerHTML = i.autoW
      ? `📐 Largura do espaço: <b>${i.w}px</b> · a foto aparece inteira, em qualquer proporção<small>Envie com pelo menos ${i.ideal[0]}px de largura. A altura da seção acompanha a foto.</small>`
      : i.autoH
      ? `📐 Altura do espaço: <b>${i.h}px</b> (largura livre)<small>Envie com pelo menos ${i.ideal[1]}px de altura.</small>`
      : `📐 Tamanho ideal: <b>${i.ideal[0]} × ${i.ideal[1]} px</b> · proporção <b>${i.proporcao}</b>` +
        `<small>${i.contain ? 'A foto aparece inteira; com outra proporção sobra fundo nas laterais.' : 'A foto preenche o espaço; com outra proporção as bordas são cortadas.'} Medido no tamanho atual da tela.</small>`;
    const r = img.getBoundingClientRect();
    dica.style.display = 'block';
    dica.style.left = Math.max(8, Math.min(window.innerWidth - dica.offsetWidth - 8, r.left + 10)) + 'px';
    dica.style.top = Math.max(BAR + 6, Math.min(window.innerHeight - dica.offsetHeight - 8, r.top + 10)) + 'px';
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target;
    if (el.tagName === 'IMG' && !inEditorUI(el)) { el.classList.add('tk-img-hover'); mostrarDica(el); return; }
    if (isEditableText(el)) el.classList.add('tk-editable-hover');
  });
  document.addEventListener('mouseout', (e) => {
    e.target.classList && (e.target.classList.remove('tk-editable-hover'), e.target.classList.remove('tk-img-hover'));
    if (e.target.tagName === 'IMG') dica.style.display = 'none';
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

  function dimensoesDoArquivo(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => { resolve({ w: im.naturalWidth, h: im.naturalHeight }); URL.revokeObjectURL(url); };
      im.onerror = () => resolve(null);
      im.src = url;
    });
  }
  // Aviso quando a foto enviada não combina com o espaço (será cortada / sobrará fundo)
  function avisoProporcao(img, dim) {
    const i = infoImagem(img);
    if (!i || !dim || i.autoH) return '';
    if (i.autoW) return dim.w < i.w ? `⚠️ a foto tem ${dim.w}px de largura, menor que o espaço (${i.w}px) — pode ficar borrada. Ideal: ${i.ideal[0]}px ou mais.` : '';
    const rFoto = dim.w / dim.h, rEspaco = i.w / i.h;
    const dif = Math.abs(rFoto - rEspaco) / rEspaco;
    const pequena = dim.w < i.w || dim.h < i.h;
    const partes = [];
    if (dif > 0.08) {
      partes.push(i.contain
        ? `a foto (${proporcaoDe(dim.w, dim.h)}) tem proporção diferente do espaço (${i.proporcao}) — vai sobrar fundo`
        : `a foto (${proporcaoDe(dim.w, dim.h)}) tem proporção diferente do espaço (${i.proporcao}) — as bordas serão cortadas`);
    }
    if (pequena) partes.push(`a foto tem ${dim.w}×${dim.h}px, menor que o espaço (${i.w}×${i.h}px) — pode ficar borrada`);
    return partes.length ? `⚠️ ${partes.join('; ')}. Ideal: ${i.ideal[0]}×${i.ideal[1]}px.` : '';
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file || !imgTarget) return;
    const aviso = avisoProporcao(imgTarget, await dimensoesDoArquivo(file));
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
      showToast(aviso ? aviso + ' Imagem trocada — não esqueça de salvar.' : 'Imagem trocada — não esqueça de salvar', aviso ? 9000 : 2400);
    } catch (err) {
      showToast('Erro: ' + err.message);
    }
  });

  // ---------- chamadas ao servidor ----------
  async function api(method, url, body) {
    const r = await fetch(url, {
      method, headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'erro no servidor');
    return j;
  }
  // grava um patch na hora (ações de página / teste A/B) e recarrega
  async function salvarAgora(patch, msg, destino) {
    const j = await api('PUT', '/api/content', patch);
    showToast((msg || '✅ Salvo!') + (j.publicando ? ' Publicando o site (~1 min)…' : ''));
    setTimeout(() => { if (destino) location.href = destino; else location.reload(); }, 900);
  }

  // ---------- painel de páginas + teste A/B ----------
  const ppanel = criarPanel('tk-ppanel');

  function renderPaginas() {
    const paginas = TK.paginas || [];
    const ab = TK.ab || { ativo: 'off', pesos: {} };
    const ativas = paginas.filter((p) => p.ativa);
    ppanel.innerHTML = `
      <h3>📄 Páginas do site</h3>
      <p class="tk-help">Cada página tem seu próprio endereço, textos, fotos, seções e estilo. <b>Clonar</b> cria a próxima
        (V${Math.max(...paginas.map((p) => Number(p.id.slice(1)))) + 1}) igual à escolhida. <b>Desativar</b> tira do ar sem perder nada;
        quem abrir o endereço dela cai na principal. <b>Excluir</b> apaga de vez.</p>
      ${paginas.map((p) => `
        <div class="tk-card ${p.id === TK.pagina ? 'tk-atual' : ''} ${p.ativa ? '' : 'tk-off'}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div><b>${escHtml(p.nome)}</b> <small style="display:inline;color:rgba(16,27,77,.5)">/${p.id}.html</small>
              ${p.principal ? '<span class="tk-tag" style="background:#FFF1D6;color:#8a5a00">⭐ principal</span>' : ''}
              ${p.ativa ? '' : '<span class="tk-tag" style="background:#EEE;color:#666">desativada</span>'}
              ${p.id === TK.pagina ? '<span class="tk-tag" style="background:#E3F1EF;color:#2f6f6a">editando</span>' : ''}</div>
          </div>
          <div class="tk-acoes">
            ${p.id !== TK.pagina ? `<button data-acao="abrir" data-id="${p.id}">✏️ Editar</button>` : ''}
            ${p.ativa ? `<button data-acao="ver" data-id="${p.id}">👁 Ver no site</button>` : ''}
            <button data-acao="clonar" data-id="${p.id}">📋 Clonar</button>
            <button data-acao="renomear" data-id="${p.id}" data-nome="${escHtml(p.nome)}">✏️ Renomear</button>
            ${p.principal ? '' : (p.ativa ? `<button data-acao="principal" data-id="${p.id}">⭐ Tornar principal</button>` : '')}
            ${p.id === 'v1' || p.principal ? '' : `<button data-acao="${p.ativa ? 'desativar' : 'ativar'}" data-id="${p.id}">${p.ativa ? '🚫 Desativar' : '✅ Ativar'}</button>`}
            ${p.id === 'v1' || p.principal ? '' : `<button data-acao="excluir" data-id="${p.id}" data-nome="${escHtml(p.nome)}" class="tk-btn-danger">🗑 Excluir</button>`}
          </div>
        </div>`).join('')}

      <h3>🧪 Teste A/B</h3>
      <p class="tk-help">Com o teste ligado, quem entra pelo endereço principal do site é dividido entre as páginas marcadas,
        na proporção dos pesos, e vê sempre a mesma versão por 30 dias. Cada clique no WhatsApp registra a página vista
        e a origem do visitante no Google Analytics e no Pixel. Precisa de pelo menos duas páginas ativas.</p>
      <label>Teste A/B</label>
      <select id="tk-ab-ativo"><option value="off" ${ab.ativo !== 'on' ? 'selected' : ''}>Desligado — todo mundo vê a principal</option>
        <option value="on" ${ab.ativo === 'on' ? 'selected' : ''}>Ligado — dividir visitantes</option></select>
      ${ativas.map((p) => `
        <label for="tk-ab-${p.id}">${escHtml(p.nome)} <small style="display:inline">(/${p.id}.html)</small> — peso %</label>
        <input id="tk-ab-${p.id}" type="number" min="0" max="100" data-ab="${p.id}" value="${ab.pesos[p.id] || 0}" placeholder="0 = fora do teste">`).join('')}
      <small id="tk-ab-soma"></small>
      <button id="tk-ab-salvar" class="tk-btn tk-btn-main">Salvar teste A/B</button>
      <div class="tk-erro" id="tk-ab-erro"></div>`;

    const soma = () => {
      const t = Array.from(ppanel.querySelectorAll('[data-ab]')).reduce((s, i) => s + (Number(i.value) || 0), 0);
      ppanel.querySelector('#tk-ab-soma').textContent = t ? `Soma dos pesos: ${t}% (as proporções são relativas — 50/50, 70/30…)` : '';
    };
    soma();
    ppanel.querySelectorAll('[data-ab]').forEach((i) => i.addEventListener('input', soma));

    ppanel.querySelector('#tk-ab-salvar').addEventListener('click', async () => {
      const erro = ppanel.querySelector('#tk-ab-erro');
      const pesos = {};
      ppanel.querySelectorAll('[data-ab]').forEach((i) => { if (Number(i.value) > 0) pesos[i.dataset.ab] = Number(i.value); });
      try {
        await salvarAgora({ ab: { pesos, ativo: ppanel.querySelector('#tk-ab-ativo').value } }, '✅ Teste A/B salvo!');
      } catch (e) { erro.textContent = e.message; }
    });

    ppanel.querySelectorAll('[data-acao]').forEach((btn) => btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const acao = btn.dataset.acao;
      try {
        if (acao === 'abrir') {
          if (pendingCount() && !confirm('Há alterações não salvas nesta página. Trocar mesmo assim?')) return;
          location.href = '/painel/' + id;
        } else if (acao === 'ver') {
          window.open('/' + id + '.html', '_blank');
        } else if (acao === 'clonar') {
          const nome = prompt('Nome da nova página (cópia de "' + btn.closest('.tk-card').querySelector('b').textContent + '"):', '');
          if (nome === null) return;
          const j = await api('POST', '/api/paginas/clonar', { de: id, nome });
          showToast('✅ Página ' + j.id.toUpperCase() + ' criada! Abrindo…');
          setTimeout(() => { location.href = '/painel/' + j.id; }, 900);
        } else if (acao === 'renomear') {
          const nome = prompt('Novo nome da página:', btn.dataset.nome);
          if (!nome || nome.trim() === btn.dataset.nome) return;
          await salvarAgora({ paginas: { [id]: { nome: nome.trim() } } }, '✅ Página renomeada!');
        } else if (acao === 'principal') {
          await salvarAgora({ config: { paginaPrincipal: id } }, '✅ Página principal alterada!');
        } else if (acao === 'desativar' || acao === 'ativar') {
          await salvarAgora({ paginas: { [id]: { ativa: acao === 'ativar' } } }, acao === 'ativar' ? '✅ Página ativada!' : '✅ Página desativada (nada foi perdido).');
        } else if (acao === 'excluir') {
          if (!confirm('Excluir DE VEZ a página "' + btn.dataset.nome + '" (/' + id + '.html)?\nTextos, fotos e estilo dela serão apagados. Se quiser só tirar do ar, use Desativar.')) return;
          const j = await api('DELETE', '/api/paginas/' + id);
          showToast('🗑 Página excluída.' + (j.publicando ? ' Publicando…' : ''));
          setTimeout(() => { location.href = id === TK.pagina ? '/painel' : location.href; location.reload(); }, 900);
        }
      } catch (e) { showToast('Erro: ' + e.message, 4000); }
    }));
  }
  bar.querySelector('#tk-btn-pages').addEventListener('click', () => togglePanel('tk-ppanel', renderPaginas));

  // ---------- painel de estilo (por página, com prévia ao vivo) ----------
  const epanel = criarPanel('tk-epanel');
  const FONTES_CSS = { 'Baloo 2': 'css/fonts-baloo.css', 'Manrope': 'css/fonts-manrope.css' };
  let estiloAtual = { ...(TK.estiloPadrao || {}), ...(TK.estilo || {}) };

  function rgbDe(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Troca, em todos os estilos inline e no CSS embutido, o valor atual pelo novo
  function substituirNaPagina(fn) {
    document.querySelectorAll('[style]').forEach((el) => {
      if (inEditorUI(el)) return;
      const v = el.getAttribute('style');
      const n = fn(v);
      if (n !== v) el.setAttribute('style', n);
    });
    const css = document.getElementById('tk-css');
    if (css) css.textContent = fn(css.textContent);
  }

  function previewEstilo(novo) {
    for (const k of ['corPrincipal', 'corEscura', 'corFundo']) {
      const de = estiloAtual[k], para = (novo[k] || de).toUpperCase();
      if (!de || para === de.toUpperCase()) continue;
      const [r, g, b] = rgbDe(de), [nr, ng, nb] = rgbDe(para);
      const reHex = new RegExp(escRe(de), 'gi');
      const reRgba = new RegExp(`rgba\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*,`, 'g');
      substituirNaPagina((s) => s.replace(reHex, para).replace(reRgba, `rgba(${nr},${ng},${nb},`));
    }
    if (novo.fonteTitulos && novo.fonteTitulos !== estiloAtual.fonteTitulos) {
      if (FONTES_CSS[novo.fonteTitulos] && !document.querySelector(`link[href="${FONTES_CSS[novo.fonteTitulos]}"]`)) {
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTES_CSS[novo.fonteTitulos];
        document.head.appendChild(l);
      }
      const re = new RegExp(`'${escRe(estiloAtual.fonteTitulos)}'`, 'g');
      substituirNaPagina((s) => s.replace(re, `'${novo.fonteTitulos}'`));
    }
    if (novo.botoes && novo.botoes !== estiloAtual.botoes) {
      const de = estiloAtual.botoes === 'reto' ? '8px' : '999px', para = novo.botoes === 'reto' ? '8px' : '999px';
      substituirNaPagina((s) => s.replace(new RegExp('border-radius:\\s*' + de, 'g'), 'border-radius:' + para));
    }
    estiloAtual = { ...estiloAtual, ...novo };
  }

  function renderEstilo() {
    const e = estiloAtual;
    const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label || v}</option>`;
    epanel.innerHTML = `
      <h3>🎨 Estilo da página "${escHtml(TK.nomePagina || TK.pagina)}"</h3>
      <p class="tk-help">Vale só para esta página — as outras continuam como estão. A prévia aparece na hora; clique em <b>Salvar</b> para gravar.</p>
      <label>Cor principal (botões e destaques)</label><input type="color" data-estilo="corPrincipal" value="${e.corPrincipal}">
      <label>Cor escura (títulos, menu e rodapé)</label><input type="color" data-estilo="corEscura" value="${e.corEscura}">
      <label>Cor de fundo</label><input type="color" data-estilo="corFundo" value="${e.corFundo}">
      <label>Fonte dos títulos</label>
      <select data-estilo="fonteTitulos">${opt('Poppins', e.fonteTitulos, 'Poppins — suave e clássica')}${opt('Baloo 2', e.fonteTitulos, 'Baloo 2 — lúdica e arredondada')}${opt('Manrope', e.fonteTitulos, 'Manrope — moderna e corporativa')}</select>
      <label>Formato dos botões</label>
      <select data-estilo="botoes">${opt('arredondado', e.botoes, 'Arredondado (pílula)')}${opt('reto', e.botoes, 'Reto (cantos levemente arredondados)')}</select>
      <button id="tk-estilo-reset" class="tk-btn" style="margin-top:16px">↩︎ Voltar ao padrão</button>`;
    epanel.querySelectorAll('[data-estilo]').forEach((f) => f.addEventListener('input', () => {
      const k = f.dataset.estilo;
      const v = f.type === 'color' ? f.value.toUpperCase() : f.value;
      previewEstilo({ [k]: v });
      pending.estilo[k] = v;
      refreshSave();
    }));
    epanel.querySelector('#tk-estilo-reset').addEventListener('click', () => {
      const padrao = TK.estiloPadrao || {};
      previewEstilo(padrao);
      for (const k of Object.keys(padrao)) pending.estilo[k] = padrao[k];
      refreshSave();
      renderEstilo();
    });
  }
  bar.querySelector('#tk-btn-style').addEventListener('click', () => togglePanel('tk-epanel', renderEstilo));

  // ---------- painel de configurações ----------
  const CFG_FIELDS = [
    ['h3', 'Site'],
    ['help', 'Configurações gerais. Tudo que você salvar aqui vale para todas as páginas, após a próxima publicação. A página principal e o teste A/B ficam em 📄 Páginas.'],
    ['select', 'config.modoLancamento', 'Modo lançamento — "on" mostra só a tela "Em breve" com senha; "off" abre o site ao público', ['on', 'off']],
    ['input', 'config.whatsappNumber', 'WhatsApp (55 + DDD + número)', 'ex.: 5547999999999'],
    ['input', 'config.pedidoMinimo', 'Pedido mínimo (frete grátis)', 'ex.: R$ 2.000'],
    ['input', 'config.instagram', 'Link do Instagram', 'https://instagram.com/...'],
    ['select', 'config.instagramAtivo', 'Instagram no site — "on" mostra o ícone no rodapé; "off" esconde', ['on', 'off']],
    ['input', 'config.facebook', 'Link do Facebook', 'https://facebook.com/...'],
    ['select', 'config.facebookAtivo', 'Facebook no site — "on" mostra o ícone no rodapé; "off" esconde', ['on', 'off']],
    ['h3', '💬 Mensagem do WhatsApp por origem'],
    ['help', 'O site descobre de onde o visitante veio (pelo utm_source do anúncio, pelo id de clique ou pelo site de origem) e começa a mensagem do WhatsApp com a frase da origem, seguida do que o botão pede (ex.: "Quero receber o catálogo Tuck Kids."). A primeira origem fica guardada por 30 dias. Nos anúncios do Meta use utm_source={{site_source_name}} para separar Facebook de Instagram.'],
    ['input', 'origem.google', 'Veio do Google (anúncio ou busca)', 'ex.: Olá, vim do site e gostaria de mais informações.'],
    ['input', 'origem.facebook', 'Veio do Facebook', 'ex.: Olá, gostaria de mais informações sobre a Tuck Kids.'],
    ['input', 'origem.instagram', 'Veio do Instagram', ''],
    ['input', 'origem.tiktok', 'Veio do TikTok', ''],
    ['input', 'origem.direto', 'Origem desconhecida / digitou o endereço', 'ex.: Olá!'],
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
    ['help', 'Cole os IDs fornecidos pelas plataformas. Com eles preenchidos, os códigos de medição são instalados sozinhos no site e cada clique nos botões de WhatsApp é contado como conversão (evento Contact/generate_lead), levando junto a origem do visitante e a página vista.'],
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

  const panel = criarPanel('tk-panel');
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
  async function carregarCfg() {
    if (cfgLoaded) return;
    const r = await fetch('/api/content');
    const content = await r.json();
    panel.querySelectorAll('[data-path]').forEach((f) => {
      const [group, key] = f.dataset.path.split('.');
      f.value = (content[group] && content[group][key]) || '';
    });
    cfgLoaded = true;
  }

  panel.addEventListener('change', (e) => {
    const f = e.target;
    if (!f.dataset.path) return;
    const [group, key] = f.dataset.path.split('.');
    pending[group][key] = f.value;
    refreshSave();
  });

  bar.querySelector('#tk-btn-cfg').addEventListener('click', () => togglePanel('tk-panel', carregarCfg));

  // ---------- salvar / sair ----------
  btnSave.addEventListener('click', async () => {
    const patch = {};
    const pg = {};
    for (const k of ['textos', 'imagens', 'secoes', 'estilo']) {
      if (Object.keys(pending[k]).length) pg[k] = pending[k];
    }
    if (Object.keys(pg).length) patch.paginas = { [TK.pagina]: pg };
    for (const k of ['vsl', 'config', 'tracking', 'origem']) {
      if (Object.keys(pending[k]).length) patch[k] = pending[k];
    }
    btnSave.disabled = true;
    btnSave.textContent = 'Salvando…';
    try {
      const j = await api('PUT', '/api/content', patch);
      showToast(j.publicando ? '✅ Salvo! Publicando o site (~1 min)…' : '✅ Alterações salvas!');
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      showToast('Erro: ' + err.message);
      refreshSave();
    }
  });

  // ---------- painel de seções (dobras) ----------
  const spanel = criarPanel('tk-spanel');

  function nomeSecao(sec, i) {
    const t = sec.querySelector('h1, h2, h3');
    let txt = t ? t.textContent.trim().replace(/\s+/g, ' ') : '';
    if (!txt && sec.id) txt = sec.id.charAt(0).toUpperCase() + sec.id.slice(1).replace(/-/g, ' ');
    return txt ? (txt.length > 42 ? txt.slice(0, 42) + '…' : txt) : ('Seção ' + (i + 1));
  }

  function renderSecoes() {
    const secs = Array.from(document.querySelectorAll('main > section'));
    spanel.innerHTML = '<h3>🧩 Seções da página "' + escHtml(TK.nomePagina || TK.pagina) + '"</h3>' +
      '<p class="tk-help">Desmarque para ocultar a seção do site publicado (só nesta página). No modo edição ela continua visível, esmaecida. Lembre de salvar.</p>' +
      secs.map((sec, i) => {
        const key = sec.dataset.tkSecao || sec.id || ('sec' + i);
        const oculta = sec.dataset.tkOculta === '1';
        return '<label style="display:flex;align-items:center;gap:10px;border:1.5px solid rgba(16,27,77,.12);border-radius:12px;padding:11px 14px;margin-bottom:8px;cursor:pointer;font-size:14px;font-weight:600;color:#101B4D">' +
          '<input type="checkbox" data-sec="' + key + '" ' + (oculta ? '' : 'checked') + ' style="width:17px;height:17px;accent-color:#4F9993">' +
          '<span style="flex:1">' + escHtml(nomeSecao(sec, i)) + '</span>' +
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
  bar.querySelector('#tk-btn-sec').addEventListener('click', () => togglePanel('tk-spanel', renderSecoes));

  bar.querySelector('#tk-btn-pub').addEventListener('click', async () => {
    const r = await fetch('/api/publish', { method: 'POST' });
    const j = await r.json();
    showToast(j.publicando ? '🚀 Publicação disparada (~1 min)' : 'Publicação automática não configurada (DEPLOY_HOOK_URL)');
  });

  // ---------- painel de usuários (admin) ----------
  const upanel = criarPanel('tk-upanel');

  async function renderUsers() {
    const users = await (await fetch('/api/users')).json();
    upanel.innerHTML = `
      <h3>👥 Usuários</h3>
      ${users.map((u) => `
        <div class="tk-card" style="${u.ativo ? '' : 'opacity:.5'}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div><b>${escHtml(u.nome)}</b> <small style="display:inline;color:rgba(16,27,77,.5)">@${escHtml(u.login)}</small><br>
            <small style="color:${u.role === 'admin' ? '#FF6655' : '#4F9993'};font-weight:800">${u.role === 'admin' ? 'Administrador' : 'Editor'}</small>
            ${u.ativo ? '' : ' · <small style="font-weight:800">desativado</small>'}</div>
            <div style="display:flex;gap:6px">
              <button data-acao="senha" data-id="${u.id}" title="Redefinir senha" style="border:0;background:#EDF4F3;border-radius:8px;padding:6px 9px;cursor:pointer">🔑</button>
              <button data-acao="ativo" data-id="${u.id}" data-v="${!u.ativo}" title="${u.ativo ? 'Desativar' : 'Reativar'}" style="border:0;background:#FDF0EA;border-radius:8px;padding:6px 9px;cursor:pointer">${u.ativo ? '🚫' : '✅'}</button>
            </div>
          </div>
        </div>`).join('')}
      <h3 style="font-size:15px">Novo usuário (ex.: agência)</h3>
      <input id="tk-u-nome" placeholder="Nome" style="margin-bottom:8px">
      <input id="tk-u-login" placeholder="Login (ex.: agencia)" style="margin-bottom:8px">
      <input id="tk-u-senha" type="password" placeholder="Senha (mín. 8 caracteres)" style="margin-bottom:8px">
      <select id="tk-u-role" style="margin-bottom:10px">
        <option value="editor">Editor — edita conteúdo (para a agência)</option>
        <option value="admin">Administrador — tudo, inclusive usuários</option>
      </select>
      <button id="tk-u-criar" class="tk-btn tk-btn-main">Criar usuário</button>
      <div id="tk-u-erro" class="tk-erro"></div>`;

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
  const lpanel = criarPanel('tk-lpanel');

  const ACAO_LABEL = { login: '🔓 Entrou', login_falhou: '⛔ Login falhou', conteudo_alterado: '✏️ Alterou conteúdo',
    imagem_enviada: '🖼️ Enviou imagem', video_enviado: '🎬 Enviou vídeo', usuario_criado: '👥 Criou usuário', usuario_alterado: '👥 Alterou usuário',
    pagina_clonada: '📄 Clonou página', pagina_excluida: '🗑 Excluiu página', publicacao: '🚀 Publicação' };
  async function renderLog() {
    const log = await (await fetch('/api/audit')).json();
    lpanel.innerHTML = '<h3>📜 Histórico de alterações e acessos</h3>' +
      (log.length ? log.map((e) => `
        <div style="border-bottom:1px solid rgba(16,27,77,.08);padding:9px 2px;font-size:13px">
          <div style="display:flex;justify-content:space-between;gap:8px">
            <b>${ACAO_LABEL[e.acao] || e.acao}</b>
            <small style="display:inline;color:rgba(16,27,77,.45);white-space:nowrap">${new Date(e.ts).toLocaleString('pt-BR')}</small>
          </div>
          <div style="color:rgba(16,27,77,.65)">${escHtml(e.usuario)}${e.detalhe ? ' · ' + escHtml(e.detalhe) : ''}</div>
        </div>`).join('') : '<p>Nenhum registro ainda.</p>');
  }

  if (isAdmin) {
    bar.querySelector('#tk-btn-users').addEventListener('click', () => togglePanel('tk-upanel', renderUsers));
    bar.querySelector('#tk-btn-log').addEventListener('click', () => togglePanel('tk-lpanel', renderLog));
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
