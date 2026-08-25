// Log de auditoria: quem fez o quê e quando.
// Guardado como JSON privado (criptografado no Blob), limitado às
// últimas MAX entradas — mais que suficiente para rastrear a agência.
const store = require('./store');

const MAX = 800;

async function record(user, acao, detalhe) {
  try {
    const log = await store.getJSON('audit', { entradas: [] }, { privado: true });
    log.entradas.unshift({
      ts: new Date().toISOString(),
      usuario: user ? `${user.nome} (${user.login})` : '-',
      role: user ? user.role : '-',
      acao,
      detalhe: String(detalhe || '').slice(0, 400),
    });
    log.entradas = log.entradas.slice(0, MAX);
    await store.setJSON('audit', log, { privado: true });
  } catch (e) {
    console.error('[audit] falha ao registrar:', e.message);
  }
}

async function list(limit = 200) {
  const log = await store.getJSON('audit', { entradas: [] }, { privado: true });
  return log.entradas.slice(0, limit);
}

module.exports = { record, list };
