// Persistência do conteúdo em JSON com gravação atômica.
// Sem banco de dados: 1 admin, poucos dados, baixa frequência de escrita.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DEFAULTS_FILE = path.join(DATA_DIR, 'content.defaults.json');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');

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

function load() {
  const defaults = JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf8'));
  if (!fs.existsSync(CONTENT_FILE)) return defaults;
  try {
    return deepMerge(defaults, JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8')));
  } catch {
    console.error('content.json corrompido — usando defaults');
    return defaults;
  }
}

function save(content) {
  const tmp = CONTENT_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(content, null, 2));
  fs.renameSync(tmp, CONTENT_FILE);
}

// Aplica um patch vindo do editor, validando o formato.
function applyPatch(patch) {
  const cur = load();
  const next = { ...cur };

  if (patch.config && typeof patch.config === 'object') {
    const allowed = ['layoutAtivo', 'whatsappNumber', 'pedidoMinimo', 'instagram', 'facebook'];
    next.config = { ...cur.config };
    for (const k of allowed) {
      if (typeof patch.config[k] === 'string') next.config[k] = patch.config[k].slice(0, 500);
    }
    if (!LAYOUTS.includes(next.config.layoutAtivo)) next.config.layoutAtivo = 'v1';
  }

  if (patch.tracking && typeof patch.tracking === 'object') {
    const allowed = ['ga4Id', 'gtmId', 'metaPixelId', 'tiktokPixelId',
      'googleSiteVerification', 'facebookDomainVerification', 'ogImage'];
    next.tracking = { ...cur.tracking };
    for (const k of allowed) {
      if (typeof patch.tracking[k] === 'string') next.tracking[k] = patch.tracking[k].trim().slice(0, 500);
    }
  }

  if (patch.textos && typeof patch.textos === 'object') {
    next.textos = { ...cur.textos };
    for (const layout of LAYOUTS) {
      if (patch.textos[layout] && typeof patch.textos[layout] === 'object') {
        next.textos[layout] = { ...cur.textos[layout] };
        for (const [key, val] of Object.entries(patch.textos[layout])) {
          if (val === null) delete next.textos[layout][key]; // null remove o override
          else if (typeof val === 'string') next.textos[layout][key] = val.slice(0, 20000);
        }
      }
    }
  }

  if (patch.imagens && typeof patch.imagens === 'object') {
    next.imagens = { ...cur.imagens };
    for (const [key, val] of Object.entries(patch.imagens)) {
      if (val === null) delete next.imagens[key];
      else if (typeof val === 'string' && /^(assets\/img|uploads)\/[\w .-]+$/.test(val)) {
        next.imagens[key] = val;
      }
    }
  }

  save(next);
  return next;
}

module.exports = { load, save, applyPatch, LAYOUTS, DATA_DIR };
