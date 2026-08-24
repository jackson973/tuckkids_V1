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

É um site 100% estático (fontes e ícones locais, funciona offline):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

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
