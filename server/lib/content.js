// Conteúdo editável do site (textos, imagens, config, tracking).
// Persistido via store (disco em dev, Vercel Blob em produção).
const fs = require('fs');
const path = require('path');
const store = require('./store');

const DEFAULTS_FILE = path.join(__dirname, '..', '..', 'data', 'content.defaults.json');
const LAYOUTS = ['v1', 'v2', 'v3'];

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

async function load() {
  const defaults = JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf8'));
  const saved = await store.getJSON('content', null);
  return saved ? deepMerge(defaults, saved) : defaults;
}

async function save(content) {
  await store.setJSON('content', content);
}

// Caminho de imagem aceito: assets do repositório, uploads locais
// ou URL do CDN do Vercel Blob
function validImagePath(val) {
  return /^(assets\/img|uploads)\/[\w .-]+$/.test(val) ||
    /^https:\/\/[\w-]+\.public\.blob\.vercel-storage\.com\/[\w/ .%-]+$/.test(val);
}

// Aplica um patch vindo do editor, validando o formato.
// Retorna { content, resumo } — resumo alimenta o log de auditoria.
async function applyPatch(patch) {
  const cur = await load();
  const next = { ...cur };
  const resumo = [];

  if (patch.config && typeof patch.config === 'object') {
    const allowed = ['layoutAtivo', 'whatsappNumber', 'pedidoMinimo', 'instagram', 'facebook', 'modoLancamento'];
    next.config = { ...cur.config };
    const mudados = [];
    for (const k of allowed) {
      if (typeof patch.config[k] === 'string' && patch.config[k] !== cur.config[k]) {
        next.config[k] = patch.config[k].slice(0, 500);
        mudados.push(k);
      }
    }
    if (!LAYOUTS.includes(next.config.layoutAtivo)) next.config.layoutAtivo = 'v1';
    if (mudados.length) resumo.push(`config: ${mudados.join(', ')}`);
  }

  if (patch.tracking && typeof patch.tracking === 'object') {
    const allowed = ['ga4Id', 'gtmId', 'metaPixelId', 'tiktokPixelId',
      'googleSiteVerification', 'facebookDomainVerification', 'ogImage'];
    next.tracking = { ...cur.tracking };
    const mudados = [];
    for (const k of allowed) {
      if (typeof patch.tracking[k] === 'string' && patch.tracking[k].trim() !== cur.tracking[k]) {
        next.tracking[k] = patch.tracking[k].trim().slice(0, 500);
        mudados.push(k);
      }
    }
    if (mudados.length) resumo.push(`rastreamento: ${mudados.join(', ')}`);
  }

  if (patch.textos && typeof patch.textos === 'object') {
    next.textos = { ...cur.textos };
    for (const layout of LAYOUTS) {
      if (patch.textos[layout] && typeof patch.textos[layout] === 'object') {
        next.textos[layout] = { ...cur.textos[layout] };
        let n = 0;
        for (const [key, val] of Object.entries(patch.textos[layout])) {
          if (val === null) { delete next.textos[layout][key]; n++; }
          else if (typeof val === 'string') { next.textos[layout][key] = val.slice(0, 20000); n++; }
        }
        if (n) resumo.push(`textos ${layout}: ${n}`);
      }
    }
  }

  if (patch.secoes && typeof patch.secoes === 'object') {
    next.secoes = { ...(cur.secoes || {}) };
    for (const layout of LAYOUTS) {
      if (patch.secoes[layout] && typeof patch.secoes[layout] === 'object') {
        next.secoes[layout] = { ...((cur.secoes || {})[layout] || {}) };
        let n = 0;
        for (const [key, val] of Object.entries(patch.secoes[layout])) {
          if (!/^[\w-]{1,60}$/.test(key)) continue;
          if (val === false) { next.secoes[layout][key] = false; n++; }
          else { delete next.secoes[layout][key]; n++; }
        }
        if (n) resumo.push(`seções ${layout}: ${n}`);
      }
    }
  }

  if (patch.imagens && typeof patch.imagens === 'object') {
    next.imagens = { ...cur.imagens };
    let n = 0;
    for (const [key, val] of Object.entries(patch.imagens)) {
      if (val === null) { delete next.imagens[key]; n++; }
      else if (typeof val === 'string' && validImagePath(val)) { next.imagens[key] = val; n++; }
    }
    if (n) resumo.push(`imagens: ${n}`);
  }

  await save(next);
  return { content: next, resumo: resumo.join(' · ') || 'sem mudanças' };
}

module.exports = { load, save, applyPatch, LAYOUTS };
