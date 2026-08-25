// Entrada para execução direta (dev, VPS, Docker).
// Na Vercel a aplicação roda via api/server.js (função serverless).
const app = require('./app');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Tuck Kids no ar em http://localhost:${PORT} (login: /admin, edição: /painel)`);
});
