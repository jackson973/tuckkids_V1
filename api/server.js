// Vercel: toda rota dinâmica (/admin, /painel, /api/*) cai aqui.
// As páginas públicas são estáticas, geradas por scripts/build-static.js.
module.exports = require('../server/app');
