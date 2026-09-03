// Conteúdo editável do site (páginas, config, tracking, origem, A/B).
// Persistido via store (disco em dev, Vercel Blob em produção).
//
// Modelo:
//   config.paginaPrincipal  → página servida na raiz "/"
//   paginas[id]             → { nome, ativa, criadaEm, textos, imagens, secoes, estilo }
//                             (v1 é a base: nasce do template e não pode ser excluída;
//                              as demais nascem como clone de uma existente)
//   ab                      → { ativo: 'on'|'off', pesos: { v1: 50, v2: 50 } }
//   origem                  → abertura da mensagem do WhatsApp por origem do visitante
const fs = require('fs');
const path = require('path');
const store = require('./store');

const DEFAULTS_FILE = path.join(__dirname, '..', '..', 'data', 'content.defaults.json');
const PAGINA_BASE = 'v1';
const MAX_PAGINAS = 20;

const ESTILO_PADRAO = {
  corPrincipal: '#FF6655',   // botões e destaques (coral)
  corEscura: '#101B4D',      // títulos e fundos escuros (navy)
  corFundo: '#FBF7EF',       // fundo da página (creme)
  fonteTitulos: 'Poppins',   // Poppins | Baloo 2 | Manrope
  botoes: 'arredondado',     // arredondado | reto
};
const FONTES = ['Poppins', 'Baloo 2', 'Manrope'];
const ORIGENS = ['google', 'facebook', 'instagram', 'tiktok', 'direto'];

function deepMerge(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function novaPagina(nome, extra) {
  return {
    nome, ativa: true, criadaEm: new Date().toISOString(),
    textos: {}, imagens: {}, secoes: {}, estilo: {},
    ...(extra || {}),
  };
}

// Conteúdo salvo no formato antigo (layouts fixos v1/v2/v3 com textos e
// seções por layout e imagens globais) vira a Página 1 do modelo novo.
// Os textos das versões v2/v3 aposentadas não se aplicam ao template e são descartados.
function migrar(saved) {
  if (!saved || saved.paginas) return saved;
  const out = { ...saved };
  out.paginas = {
    v1: novaPagina('Página 1', {
      textos: (saved.textos && saved.textos.v1) || {},
      secoes: (saved.secoes && saved.secoes.v1) || {},
      imagens: saved.imagens || {},
    }),
  };
  delete out.textos; delete out.secoes; delete out.imagens;
  if (out.config) { out.config = { ...out.config }; delete out.config.layoutAtivo; }
  return out;
}

function idsPaginas(content) {
  return Object.keys(content.paginas || {}).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

function paginasAtivas(content) {
  return idsPaginas(content).filter((id) => content.paginas[id].ativa !== false);
}

function estiloDe(content, id) {
  const p = (content.paginas || {})[id] || {};
  return { ...ESTILO_PADRAO, ...(p.estilo || {}) };
}

// Garante invariantes após qualquer carga/alteração
function sanear(content) {
  if (!content.paginas || !content.paginas[PAGINA_BASE]) {
    content.paginas = { ...(content.paginas || {}), [PAGINA_BASE]: novaPagina('Página 1') };
  }
  for (const [id, p] of Object.entries(content.paginas)) {
    if (!/^v\d{1,3}$/.test(id)) { delete content.paginas[id]; continue; }
    p.nome = p.nome || ('Página ' + id.slice(1));
    p.textos = p.textos || {}; p.imagens = p.imagens || {}; p.secoes = p.secoes || {}; p.estilo = p.estilo || {};
  }
  content.paginas[PAGINA_BASE].ativa = true;
  content.config = content.config || {};
  if (!content.paginas[content.config.paginaPrincipal] || content.paginas[content.config.paginaPrincipal].ativa === false) {
    content.config.paginaPrincipal = PAGINA_BASE;
  }
  content.ab = content.ab || { ativo: 'off', pesos: {} };
  const pesos = {};
  for (const id of paginasAtivas(content)) {
    if (content.ab.pesos && typeof content.ab.pesos[id] === 'number' && content.ab.pesos[id] > 0) pesos[id] = content.ab.pesos[id];
  }
  content.ab.pesos = pesos;
  if (Object.keys(pesos).length < 2) content.ab.ativo = 'off';
  content.origem = content.origem || {};
  return content;
}

async function load() {
  const defaults = JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf8'));
  const saved = migrar(await store.getJSON('content', null));
  return sanear(saved ? deepMerge(defaults, saved) : defaults);
}

async function save(content) {
  content.salvoEm = new Date().toISOString();
  await store.setJSON('content', content);
}

// Caminho de imagem aceito: assets do repositório, uploads locais
// ou URL do CDN do Vercel Blob
function validImagePath(val) {
  return /^(assets\/img|uploads)\/[\w .-]+$/.test(val) ||
    /^https:\/\/[\w-]+\.public\.blob\.vercel-storage\.com\/[\w/ .%-]+$/.test(val);
}

function hexOk(v) { return /^#[0-9a-fA-F]{6}$/.test(v); }

// Aplica um patch vindo do editor, validando o formato.
// Retorna { content, resumo } — resumo alimenta o log de auditoria.
async function applyPatch(patch) {
  const cur = await load();
  const next = { ...cur };
  const resumo = [];

  if (patch.config && typeof patch.config === 'object') {
    const allowed = ['paginaPrincipal', 'whatsappNumber', 'pedidoMinimo', 'instagram', 'instagramAtivo', 'facebook', 'facebookAtivo', 'modoLancamento'];
    next.config = { ...cur.config };
    const mudados = [];
    for (const k of allowed) {
      if (typeof patch.config[k] === 'string' && patch.config[k] !== cur.config[k]) {
        next.config[k] = patch.config[k].slice(0, 500);
        mudados.push(k);
      }
    }
    if (mudados.includes('paginaPrincipal')) {
      const p = cur.paginas[next.config.paginaPrincipal];
      if (!p) throw new Error('página principal inexistente');
      if (p.ativa === false) throw new Error('uma página desativada não pode ser a principal');
    }
    if (mudados.length) resumo.push(`config: ${mudados.join(', ')}`);
  }

  if (patch.tracking && typeof patch.tracking === 'object') {
    const allowed = ['ga4Id', 'gtmId', 'metaPixelId', 'tiktokPixelId',
      'googleSiteVerification', 'facebookDomainVerification', 'ogImage'];
    // Tolerância a colagem: se o usuário colar a meta tag inteira
    // (<meta ... content="CODIGO">), extrai só o código automaticamente
    const normalizar = (k, v) => {
      v = v.trim();
      if (k === 'googleSiteVerification' || k === 'facebookDomainVerification') {
        const m = v.match(/content=["']([^"']+)["']/i);
        if (m) v = m[1].trim();
        v = v.replace(/^["']|["']$/g, '');
      }
      return v.slice(0, 500);
    };
    next.tracking = { ...cur.tracking };
    const mudados = [];
    for (const k of allowed) {
      if (typeof patch.tracking[k] === 'string') {
        const v = normalizar(k, patch.tracking[k]);
        if (v !== cur.tracking[k]) {
          next.tracking[k] = v;
          mudados.push(k);
        }
      }
    }
    if (mudados.length) resumo.push(`rastreamento: ${mudados.join(', ')}`);
  }

  // Abertura da mensagem do WhatsApp por origem do visitante
  if (patch.origem && typeof patch.origem === 'object') {
    next.origem = { ...cur.origem };
    const mudados = [];
    for (const k of ORIGENS) {
      if (typeof patch.origem[k] === 'string' && patch.origem[k].trim().slice(0, 300) !== (cur.origem[k] || '')) {
        next.origem[k] = patch.origem[k].trim().slice(0, 300);
        mudados.push(k);
      }
    }
    if (mudados.length) resumo.push(`origem: ${mudados.join(', ')}`);
  }

  // Páginas: nome, ativa, textos, imagens, seções e estilo — por página
  if (patch.paginas && typeof patch.paginas === 'object') {
    next.paginas = { ...cur.paginas };
    for (const [id, pp] of Object.entries(patch.paginas)) {
      const atual = cur.paginas[id];
      if (!atual || !pp || typeof pp !== 'object') continue;
      const p = { ...atual, textos: { ...atual.textos }, imagens: { ...atual.imagens }, secoes: { ...atual.secoes }, estilo: { ...atual.estilo } };
      const mudados = [];

      if (typeof pp.nome === 'string' && pp.nome.trim() && pp.nome.trim().slice(0, 60) !== atual.nome) {
        p.nome = pp.nome.trim().slice(0, 60); mudados.push('nome');
      }
      if (typeof pp.ativa === 'boolean' && pp.ativa !== (atual.ativa !== false)) {
        if (id === PAGINA_BASE && !pp.ativa) throw new Error('a Página 1 não pode ser desativada');
        if (!pp.ativa && id === (next.config || cur.config).paginaPrincipal) throw new Error('escolha outra página principal antes de desativar esta');
        p.ativa = pp.ativa; mudados.push(pp.ativa ? 'ativada' : 'desativada');
      }
      if (pp.textos && typeof pp.textos === 'object') {
        let n = 0;
        for (const [key, val] of Object.entries(pp.textos)) {
          if (val === null) { delete p.textos[key]; n++; }
          else if (typeof val === 'string') { p.textos[key] = val.slice(0, 20000); n++; }
        }
        if (n) mudados.push(`${n} texto(s)`);
      }
      if (pp.imagens && typeof pp.imagens === 'object') {
        let n = 0;
        for (const [key, val] of Object.entries(pp.imagens)) {
          if (val === null) { delete p.imagens[key]; n++; }
          else if (typeof val === 'string' && validImagePath(val)) { p.imagens[key] = val; n++; }
        }
        if (n) mudados.push(`${n} imagem(ns)`);
      }
      if (pp.secoes && typeof pp.secoes === 'object') {
        let n = 0;
        for (const [key, val] of Object.entries(pp.secoes)) {
          if (!/^[\w-]{1,60}$/.test(key)) continue;
          if (val === false) { p.secoes[key] = false; n++; }
          else { delete p.secoes[key]; n++; }
        }
        if (n) mudados.push(`${n} seção(ões)`);
      }
      if (pp.estilo && typeof pp.estilo === 'object') {
        const e = pp.estilo;
        let n = 0;
        for (const k of ['corPrincipal', 'corEscura', 'corFundo']) {
          if (typeof e[k] === 'string' && hexOk(e[k]) && e[k].toUpperCase() !== (p.estilo[k] || ESTILO_PADRAO[k]).toUpperCase()) {
            p.estilo[k] = e[k].toUpperCase(); n++;
          }
        }
        if (typeof e.fonteTitulos === 'string' && FONTES.includes(e.fonteTitulos) && e.fonteTitulos !== (p.estilo.fonteTitulos || ESTILO_PADRAO.fonteTitulos)) {
          p.estilo.fonteTitulos = e.fonteTitulos; n++;
        }
        if (typeof e.botoes === 'string' && ['arredondado', 'reto'].includes(e.botoes) && e.botoes !== (p.estilo.botoes || ESTILO_PADRAO.botoes)) {
          p.estilo.botoes = e.botoes; n++;
        }
        if (n) mudados.push('estilo');
      }
      if (mudados.length) { next.paginas[id] = p; resumo.push(`${atual.nome} (${id}): ${mudados.join(', ')}`); }
    }
  }

  // Teste A/B: quais páginas ativas concorrem na raiz e com que peso (%)
  if (patch.ab && typeof patch.ab === 'object') {
    next.ab = { ...cur.ab, pesos: { ...cur.ab.pesos } };
    const mudados = [];
    if (patch.ab.pesos && typeof patch.ab.pesos === 'object') {
      const pesos = {};
      for (const [id, v] of Object.entries(patch.ab.pesos)) {
        const n = Number(v);
        const p = next.paginas[id];
        if (!p || p.ativa === false || !Number.isFinite(n) || n <= 0) continue;
        pesos[id] = Math.min(100, Math.round(n));
      }
      next.ab.pesos = pesos; mudados.push('pesos');
    }
    if (typeof patch.ab.ativo === 'string' && ['on', 'off'].includes(patch.ab.ativo)) {
      if (patch.ab.ativo === 'on' && Object.keys(next.ab.pesos).length < 2) {
        throw new Error('o teste A/B precisa de pelo menos duas páginas ativas com peso');
      }
      if (patch.ab.ativo !== cur.ab.ativo) { next.ab.ativo = patch.ab.ativo; mudados.push(patch.ab.ativo === 'on' ? 'ligado' : 'desligado'); }
    }
    if (mudados.length) resumo.push(`teste A/B: ${mudados.join(', ')}`);
  }

  if (patch.vsl && typeof patch.vsl === 'object') {
    next.vsl = { ...(cur.vsl || {}) };
    const mudados = [];
    const p = patch.vsl;
    const urlVideoOk = (v) => v === '' ||
      /^https:\/\/[\w.-]+\/[^\s"']+\.(mp4|webm)(\?[^\s"']*)?$/i.test(v) ||
      /^https:\/\/[\w-]+\.public\.blob\.vercel-storage\.com\/[^\s"']+$/i.test(v) ||
      /^uploads\/[\w .-]+\.(mp4|webm)$/i.test(v);
    for (const campo of ['videoUrl', 'videoUrlMobile']) {
      if (typeof p[campo] === 'string') {
        const v = p[campo].trim();
        if (!urlVideoOk(v)) throw new Error('URL de vídeo inválida (use um link https terminando em .mp4/.webm ou envie pelo painel)');
        if (v !== cur.vsl[campo]) { next.vsl[campo] = v; mudados.push(campo); }
      }
    }
    if (typeof p.autoplay === 'string' && ['on', 'off'].includes(p.autoplay) && p.autoplay !== cur.vsl.autoplay) {
      next.vsl.autoplay = p.autoplay; mudados.push('autoplay');
    }
    if (typeof p.pitchSegundos === 'string' && /^\d{0,4}$/.test(p.pitchSegundos.trim()) && p.pitchSegundos.trim() !== cur.vsl.pitchSegundos) {
      next.vsl.pitchSegundos = p.pitchSegundos.trim(); mudados.push('pitchSegundos');
    }
    if (typeof p.ctaTexto === 'string' && p.ctaTexto.slice(0, 120) !== cur.vsl.ctaTexto) {
      next.vsl.ctaTexto = p.ctaTexto.slice(0, 120); mudados.push('ctaTexto');
    }
    if (mudados.length) resumo.push(`vídeo: ${mudados.join(', ')}`);
  }

  sanear(next);
  await save(next);
  return { content: next, resumo: resumo.join(' · ') || 'sem mudanças' };
}

// Clona uma página existente: nasce ativa, com o próximo número livre,
// carregando textos, imagens, seções ocultas e estilo da original.
async function clonar(deId, nome) {
  const content = await load();
  const orig = content.paginas[deId];
  if (!orig) throw new Error('página de origem inexistente');
  const ids = idsPaginas(content);
  if (ids.length >= MAX_PAGINAS) throw new Error(`limite de ${MAX_PAGINAS} páginas atingido`);
  const n = Math.max(...ids.map((id) => Number(id.slice(1)))) + 1;
  const id = 'v' + n;
  content.paginas[id] = novaPagina((nome && String(nome).trim().slice(0, 60)) || `Página ${n}`, {
    textos: { ...orig.textos }, imagens: { ...orig.imagens }, secoes: { ...orig.secoes }, estilo: { ...orig.estilo },
    clonadaDe: deId,
  });
  await save(content);
  return { id, pagina: content.paginas[id], content };
}

// Exclui de vez (a base e a principal não podem ser excluídas)
async function excluir(id) {
  const content = await load();
  const p = content.paginas[id];
  if (!p) throw new Error('página inexistente');
  if (id === PAGINA_BASE) throw new Error('a Página 1 é a base do site e não pode ser excluída');
  if (id === content.config.paginaPrincipal) throw new Error('escolha outra página principal antes de excluir esta');
  delete content.paginas[id];
  sanear(content);
  await save(content);
  return { nome: p.nome, content };
}

module.exports = {
  load, save, applyPatch, clonar, excluir,
  idsPaginas, paginasAtivas, estiloDe,
  PAGINA_BASE, ESTILO_PADRAO, FONTES, ORIGENS,
};
