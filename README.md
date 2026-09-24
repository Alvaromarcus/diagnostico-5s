# 🏭 Diagnóstico 5S — Ferramenta Digital

Ferramenta web para avaliação de maturidade do Programa 5S (Lean Manufacturing).

## Módulos

- **Diagnóstico 5S** (`index.html`): avaliação de maturidade, radar, plano de ação 5W2H e PDF.
- **Mapeamento do Fluxo de Valor – MFV** (`mfv.html`): formulário em 3 passos, cálculo automático de
  tempo disponível, takt time, dias de estoque, tempo de ciclo total e lead time total; mapa do estado
  atual em SVG com pan/zoom (pinça no celular) e visão em lista; exportação em SVG, PNG e **PDF em folha A3 paisagem**.

## Deploy no Netlify (gratuito)

1. Faça fork ou clone deste repositório no GitHub
2. Acesse [netlify.com](https://netlify.com) e faça login com GitHub
3. Clique em **"Add new site" → "Import an existing project"**
4. Selecione este repositório
5. Configurações de build: deixe tudo em branco (site estático)
6. Clique em **"Deploy site"**
7. Seu site estará disponível em `https://[nome-gerado].netlify.app`

### Domínio personalizado (opcional)
- No Netlify: Site settings → Domain management → Add custom domain
- Você pode usar um domínio gratuito do tipo `diagnostico-5s.netlify.app`
  alterando o nome nas configurações do site no Netlify.

## Tecnologias utilizadas

- HTML5 + CSS3 + JavaScript (vanilla, sem framework)
- Chart.js (radar chart dos resultados)
- jsPDF + jsPDF-AutoTable (geração de PDF; o MFV exporta sempre em A3 paisagem)
- Hospedagem: Netlify (plano gratuito)
