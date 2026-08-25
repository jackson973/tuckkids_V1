# Tuck Kids — Landing Pages (V1 · V2 · V3)

Landing pages da **Tuck Kids** (moda infantil no atacado, direto de fábrica — Gaspar/SC), convertidas dos designs criados no Claude Design para site estático puro (HTML + CSS + JS, sem frameworks nem build). Três versões para aprovação do cliente, com seletor flutuante para alternar entre elas.

> Vestindo infâncias, criando memórias.

## As três versões

| Página | Estilo | Fontes |
|---|---|---|
| [v1.html](v1.html) | Suave/clássico — fundo creme, cantos orgânicos | Poppins + Nunito Sans |
| [v2.html](v2.html) | Lúdico/sticker — bordas grossas, sombras duras, rotações, emojis | Baloo 2 + Nunito Sans |
| [v3.html](v3.html) | Corporativo/performance B2B — fundo branco, hero navy, preços por categoria | Manrope |

`index.html` redireciona para a **versão padrão** (hoje: V1). Quando o cliente aprovar uma versão, basta trocar o destino do redirect ali. O seletor **V1 / V2 / V3** fica fixo no canto inferior esquerdo de cada página.

## Como rodar

**Com o painel de edição (backend Node.js):**

```bash
npm install
ADMIN_PASSWORD=sua-senha npm start
# site:  http://localhost:3000  (a raiz serve o layout ativo escolhido no painel)
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

Rotas: `/` site publicado (layout ativo, sem seletor) · `/v1|v2|v3.html` comparação · `/admin` login · `/painel` edição ao vivo.

## Modo lançamento ("Em breve")

Enquanto `Configurações → Modo lançamento = on`, o público vê só a tela **"Tuck Kids — Vestindo infâncias, criando memórias"**. Easter egg de acesso: clicar no **T** e depois no **K** do título abre o campo de senha (senha: `vamosvencer`) — libera o site para aquela sessão do navegador. O painel `/painel` nunca é bloqueado. Para lançar o site de verdade: mude para `off` e salve.

## Painel de edição (backend)

- **Usuários e papéis**: `admin` (tudo, inclusive criar/desativar usuários e ver histórico) e `editor` (edita conteúdo — ideal para a agência de marketing). Gestão pelo botão 👥 do painel. O primeiro admin é criado na tela de Configuração Inicial do `/admin` (ou, opcionalmente, semeado por `ADMIN_PASSWORD`).
- **Auditoria**: todo login (inclusive falhas, com IP), alteração de conteúdo, upload de imagem, mudança de usuário e publicação ficam no 📜 Histórico (últimas 800 entradas, visível só para admin; criptografado no Blob).
- **Armazenamento**: local/VPS → pasta `data/`; Vercel → Blob (conteúdo público em JSON; usuários e auditoria criptografados AES-256-GCM com chave derivada de `SESSION_SECRET`; imagens com URL de CDN).

- **Login**: `/admin` — senhas com bcrypt, sessão em cookie httpOnly assinado, rate-limit de 5 tentativas/15min.
- **Edição inline**: autenticado, a própria página vira editor — clique num texto para editar, numa imagem para trocar (upload). "Salvar" persiste tudo.
- **Compatível com os 3 layouts**: textos são salvos por versão (v1/v2/v3); imagens e configurações são globais. O campo "Layout ativo" define qual versão a raiz `/` serve.
- **Rastreamento configurável pelo painel** (injetado server-side no `<head>`): Meta Pixel, Google Analytics 4, Google Tag Manager, TikTok Pixel, verificação do Google Search Console e do Meta (domain verification), `og:image`. Cliques em botões de WhatsApp disparam eventos de conversão (GA4 `whatsapp_click`/`generate_lead`, Pixel `Contact`).
- **SEO**: `/sitemap.xml` e `/robots.txt` gerados dinamicamente.
- **Armazenamento sem banco**: `data/content.json` (gravação atômica) + `data/uploads/` para imagens — suficiente para 1 admin e baixo volume; monte `data/` como volume persistente no deploy. Se um dia precisar de leads/pedidos, o caminho é SQLite → Postgres.
- As chaves de override de texto são baseadas na posição do elemento no DOM: **se a estrutura HTML de um layout mudar, os textos editados daquele layout podem precisar ser re-editados**.

## Estrutura

```
index.html          Redirect para a versão padrão
v1.html/v2.html/v3.html  As três landing pages completas
css/style.css       Estilos da V1 · css/v2.css · css/v3.css
css/fonts.css       Nunito Sans + Poppins · fonts-v2.css (Baloo 2) · fonts-v3.css (Manrope)
css/switcher.css    Seletor de versões (compartilhado)
js/main.js          Config + interações compartilhadas (menu, FAQ, contadores, WhatsApp)
assets/img/         Fotos reais do design (produtos, galeria, fábrica, logo)
assets/fonts/       Arquivos .woff2 locais
assets/icons/       Ícones Lucide em SVG
design/             Fontes .dc.html originais do Claude Design (referência)
```

## Configuração

Em `js/main.js` (`TK_CONFIG`):

- `whatsappNumber` — **TODO: número oficial ainda é placeholder** (`5547999999999`). Todos os botões/links de WhatsApp usam esse valor.
- `pedidoMinimo` — valor exibido em todos os pontos das páginas (`R$ 2.000`).
- Uma página pode sobrescrever mensagens de WhatsApp via `window.TK_MSG_OVERRIDES` (a V3 usa para pedir também a tabela de preços).

## Pendências conhecidas

- **Depoimentos são ilustrativos** (marcados nas próprias páginas) — substituir pelos reais.
- Links de **Instagram/Facebook** e páginas de **Termos de Uso / Política de Privacidade** apontam para `#`.
- O botão de play do vídeo (VSL) abre o WhatsApp; trocar pelo vídeo real quando existir.

## Dados cadastrais (nos rodapés)

- CNPJ: 33.736.227/0001-59
- Inscrição Estadual: 26.009.473-0
- CEP 89111-390 · Bairro Gaspar Grande · Gaspar — SC

## Próxima fase

Após a aprovação de uma versão pelo cliente: área administrativa do sistema (gestão de conteúdo — fotos de produtos, depoimentos, configurações).
