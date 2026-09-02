# Tuck Kids — Landing Page + Painel

Landing page da **Tuck Kids** (moda infantil no atacado, direto de fábrica — Gaspar/SC), convertida do design criado no Claude Design para HTML + CSS + JS puros, com painel de edição inline, **páginas clonáveis** (cada uma com textos, fotos, seções e estilo próprios), **teste A/B** na raiz do site e **mensagem de WhatsApp por origem do visitante** (Google, Facebook, Instagram, TikTok).

> Vestindo infâncias, criando memórias.

## Páginas (clonar · desativar · excluir)

O site tem um único template ([pagina.html](pagina.html), o antigo layout V1 — as versões V2/V3 foram aposentadas). No painel, o botão **📄 Páginas** lista as páginas do site:

- **Página 1 (`/v1.html`)** é a base: nasce do template, não pode ser desativada nem excluída.
- **Clonar** cria a próxima numeração (`/v2.html`, `/v3.html`, …) igual à página escolhida no momento — textos, fotos, seções ocultas e estilo. Depois disso cada uma anda sozinha.
- **Desativar** tira a página do ar sem perder nada: o endereço dela redireciona para a raiz (preservando `?utm_…`) e ela continua editável no painel. **Ativar** volta.
- **Excluir** apaga de vez (com confirmação). A página **principal** (⭐) é a servida na raiz `/`; não pode ser desativada nem excluída sem antes escolher outra.
- **🎨 Estilo** (por página, com prévia ao vivo): cor principal (botões), cor escura (títulos/menu/rodapé), cor de fundo, fonte dos títulos (Poppins, Baloo 2 ou Manrope) e formato dos botões (arredondado ou reto). Aplicado server-side no HTML e no CSS embutido.

## Teste A/B

Em **📄 Páginas → 🧪 Teste A/B**: ligar, escolher quais páginas ativas concorrem e o peso (%) de cada uma. Quem entra pela raiz `/` é sorteado pelos pesos e recebe o cookie `tk_ab` (30 dias), vendo sempre a mesma versão. Na Vercel isso é feito pelo [middleware.js](middleware.js) (Edge), que lê `dist/ab.json` gerado no build e **reescreve** a raiz para `/vN.html` sem mudar a URL; em dev/VPS a mesma lógica está em `server/app.js`. Cada clique no WhatsApp envia `pagina` (variante vista) e `origem` nos eventos do GA4/Pixel/TikTok/dataLayer.

## Origem do visitante e mensagem do WhatsApp

`js/main.js` descobre de onde o visitante veio, nesta ordem: `utm_source` → id de clique (`gclid`/`gbraid`/`wbraid` = Google, `fbclid` = Meta, `ttclid` = TikTok) → referrer → "direto". **Primeiro toque**: a primeira origem real fica em `localStorage` por 30 dias. A mensagem do WhatsApp = **abertura da origem** (editável em ⚙️ → 💬 Mensagem do WhatsApp por origem) + **intenção do botão** (catálogo, especialista, representante…).

Nos anúncios do Meta, use `utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{placement}}` — o Meta preenche `fb`/`ig`/`msg`/`an`, separando Facebook de Instagram (o navegador interno do Instagram muitas vezes não envia referrer, então o utm é essencial). No Google Ads a marcação automática (`gclid`) basta.

## Como rodar

**Com o painel de edição (backend Node.js):**

```bash
npm install
ADMIN_PASSWORD=sua-senha npm start
# site:  http://localhost:3000  (a raiz serve a página principal ou a variante do teste A/B)
# admin: http://localhost:3000/admin
```

Ou com Docker: `docker build -t tuckkids . && docker run -p 3000:3000 -v tuckkids-data:/app/data -e ADMIN_PASSWORD=sua-senha tuckkids`

**Só o site estático** (sem painel — é o que o GitHub Pages serve):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Deploy na Vercel (produção)

O site público é **estático** (gerado no build a partir do conteúdo salvo); o painel e a API rodam como função serverless. **Todo "Salvar" no painel dispara um Deploy Hook → novo build → site atualizado (~1 min).** A edição ao vivo acontece em `/painel` (sempre lê o conteúdo mais recente).

Passo a passo:

1. **Importar o projeto**: vercel.com → Add New → Project → importe `jackson973/tuckkids_V1` (as configurações vêm do `vercel.json`)
2. **Storage**: aba Storage do projeto → Create → **Blob** → conectar ao projeto (cria `BLOB_READ_WRITE_TOKEN` sozinha)
3. **Variáveis** (Settings → Environment Variables): `SESSION_SECRET` (obrigatória — valor longo aleatório) e `SITE_URL` (domínio final). *Nenhuma senha em variável*: no primeiro acesso ao `/admin` a tela de **Configuração Inicial** cria o primeiro administrador, gravado criptografado no armazenamento (`ADMIN_PASSWORD` existe só como semente opcional)
4. **Deploy Hook**: Settings → Git → Deploy Hooks → Create (branch `master`) → copie a URL para a variável `DEPLOY_HOOK_URL` → Redeploy

Rotas: `/` site publicado (página principal / teste A/B) · `/vN.html` cada página · `/admin` login · `/painel` e `/painel/vN` edição ao vivo.

## Modo lançamento ("Em breve")

Enquanto `Configurações → Modo lançamento = on`, o público vê só a tela **"Tuck Kids — Vestindo infâncias, criando memórias"**. Easter egg de acesso: clicar no **T** e depois no **K** do título abre o campo de senha (senha: `vamosvencer`) — libera o site para aquela sessão do navegador. O painel `/painel` nunca é bloqueado. Para lançar o site de verdade: mude para `off` e salve.

## Painel de edição (backend)

- **Usuários e papéis**: `admin` (tudo, inclusive criar/desativar usuários e ver histórico) e `editor` (edita conteúdo — ideal para a agência de marketing). Gestão pelo botão 👥 do painel. O primeiro admin é criado na tela de Configuração Inicial do `/admin` (ou, opcionalmente, semeado por `ADMIN_PASSWORD`).
- **Auditoria**: todo login (inclusive falhas, com IP), alteração de conteúdo, upload de imagem, mudança de usuário e publicação ficam no 📜 Histórico (últimas 800 entradas, visível só para admin; criptografado no Blob).
- **Armazenamento**: local/VPS → pasta `data/`; Vercel → Blob (conteúdo público em JSON; usuários e auditoria criptografados AES-256-GCM com chave derivada de `SESSION_SECRET`; imagens com URL de CDN).

- **Login**: `/admin` — senhas com bcrypt, sessão em cookie httpOnly assinado, rate-limit de 5 tentativas/15min.
- **Edição inline**: autenticado, a própria página vira editor — clique num texto para editar, numa imagem para trocar (upload). "Salvar" persiste tudo.
- **Por página**: textos, imagens, seções ocultas e estilo são salvos por página (`paginas.vN`); configurações, vídeo, rastreamento e aberturas por origem são globais. Conteúdo salvo no formato antigo (layouts v1/v2/v3) é migrado automaticamente para a Página 1.
- **Rastreamento configurável pelo painel** (injetado server-side no `<head>`): Meta Pixel, Google Analytics 4, Google Tag Manager, TikTok Pixel, verificação do Google Search Console e do Meta (domain verification), `og:image`. Cliques em botões de WhatsApp disparam eventos de conversão (GA4 `whatsapp_click`/`generate_lead`, Pixel `Contact`) com `origem`, `pagina` e utm.
- **SEO**: `/sitemap.xml` e `/robots.txt` gerados dinamicamente.
- **Armazenamento sem banco**: `data/content.json` (gravação atômica) + `data/uploads/` para imagens — suficiente para 1 admin e baixo volume; monte `data/` como volume persistente no deploy. Se um dia precisar de leads/pedidos, o caminho é SQLite → Postgres.
- As chaves de override de texto são baseadas na posição do elemento no DOM: **se a estrutura de `pagina.html` mudar, os textos editados podem precisar ser re-editados**.

## Estrutura

```
index.html          Redirect para pagina.html (só sem servidor)
pagina.html         Template único da landing page (todas as páginas nascem dele)
middleware.js       Edge Middleware da Vercel: sorteio do teste A/B na raiz
css/style.css       Estilos base (embutidos no HTML com as cores da página)
css/fonts.css       Nunito Sans + Poppins · fonts-baloo.css (Baloo 2) · fonts-manrope.css (Manrope)
js/main.js          Config, origem do visitante, mensagens de WhatsApp, interações (menu, FAQ, contadores)
js/cms.js           Hidratação do conteúdo da página + eventos de conversão
js/editor.js        Editor inline e painéis (páginas, A/B, estilo, seções, configurações)
server/lib/content.js  Modelo de conteúdo: páginas, clonar/excluir, A/B, origem
server/lib/inject.js   Estilo por página + injeção de conteúdo e rastreamento
assets/img/         Fotos reais do design (produtos, galeria, fábrica, logo)
assets/fonts/       Arquivos .woff2 locais
assets/icons/       Ícones Lucide em SVG
design/             Fontes .dc.html originais do Claude Design (referência)
```

## Configuração

Em `js/main.js` (`TK_CONFIG`):

- `whatsappNumber` — **TODO: número oficial ainda é placeholder** (`5547999999999`). Todos os botões/links de WhatsApp usam esse valor.
- `pedidoMinimo` — valor exibido em todos os pontos das páginas (`R$ 2.000`).
- As intenções dos botões de WhatsApp (`WA_MESSAGES`) podem ser sobrescritas via `window.TK_MSG_OVERRIDES`; as aberturas por origem vêm do painel.

## Pendências conhecidas

- **Depoimentos são ilustrativos** (marcados nas próprias páginas) — substituir pelos reais.
- Links de **Instagram/Facebook** e páginas de **Termos de Uso / Política de Privacidade** apontam para `#`.
- O vídeo da seção "Conheça a Tuck Kids" usa o Smart Player próprio (estilo VTurb): configure em ⚙️ → 🎬 Vídeo (upload .mp4 ou URL); sem vídeo configurado, a seção mostra a imagem com botão de WhatsApp.

## Dados cadastrais (nos rodapés)

- CNPJ: 33.736.227/0001-59
- Inscrição Estadual: 26.009.473-0
- CEP 89111-390 · Bairro Gaspar Grande · Gaspar — SC

## Próxima fase

Contador de cliques por página e por origem dentro do painel (hoje o resultado do teste A/B é lido no GA4 / Gerenciador de Anúncios).
