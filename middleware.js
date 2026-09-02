// Vercel Edge Middleware — teste A/B na raiz do site.
// Só roda em "/". Lê dist/ab.json (gerado no build com a configuração
// do painel); com o teste ligado, sorteia uma variante pelos pesos,
// grava a escolha num cookie de 30 dias e reescreve a raiz para
// /vN.html — o visitante vê sempre a mesma versão e a URL não muda.
// Mesma lógica de paginaDaRaiz() em server/app.js (dev/VPS).
export const config = { matcher: '/' };

const COOKIE = 'tk_ab';

function cookieValue(header, nome) {
  for (const part of (header || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return '';
}

function sortear(pesos) {
  const ids = Object.keys(pesos);
  const total = ids.reduce((s, id) => s + pesos[id], 0);
  let r = Math.random() * total;
  for (const id of ids) { r -= pesos[id]; if (r < 0) return id; }
  return ids[ids.length - 1];
}

export default async function middleware(request) {
  const url = new URL(request.url);
  let ab;
  try {
    const r = await fetch(new URL('/ab.json', url.origin), { headers: { 'x-tk-mw': '1' } });
    if (!r.ok) return;
    ab = await r.json();
  } catch {
    return; // sem configuração → segue para o index.html normal
  }
  const ids = Object.keys((ab && ab.pesos) || {});
  if (!ab || ab.ativo !== 'on' || ids.length < 2) return;

  const lembrada = cookieValue(request.headers.get('cookie'), COOKIE);
  const escolhida = ids.includes(lembrada) ? lembrada : sortear(ab.pesos);

  const destino = new URL(`/${escolhida}.html`, url.origin);
  destino.search = url.search;
  const headers = { 'x-middleware-rewrite': destino.toString() };
  if (escolhida !== lembrada) {
    headers['set-cookie'] = `${COOKIE}=${escolhida}; Path=/; Max-Age=2592000; SameSite=Lax`;
  }
  return new Response(null, { headers });
}
