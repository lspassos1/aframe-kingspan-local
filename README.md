# Estudo Construtivo

Aplicação para estudo construtivo modular, pré-orçamento assistido e revisão de quantitativos a partir de planta baixa, medidas manuais ou projeto exemplo.

O produto não começa pelo método construtivo. O fluxo principal é:

1. enviar planta baixa;
2. revisar dados extraídos ou preencher medidas simples;
3. escolher ou confirmar o método construtivo;
4. gerar quantitativos;
5. vincular base de preços importada;
6. revisar orçamento preliminar;
7. exportar JSON, XLSX, CSV e PDF.

A experiência atual ainda mantém o fluxo A-frame completo como baseline de regressão técnica. Isso significa que criação de estudo A-frame, modelo 3D, geometria, materiais, estrutura, orçamento preliminar e exportações existentes não devem quebrar durante a evolução do produto.

## Rodar Localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Configuração

Copie `.env.example` para `.env.local` no desenvolvimento local. Em produção ou preview Vercel, configure as mesmas variáveis em Project Settings > Environment Variables e faça redeploy quando alterar valores usados no servidor.

Variáveis comuns:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/start`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/start`
- `GITHUB_FEEDBACK_TOKEN`
- `GITHUB_FEEDBACK_REPO=lspassos1/aframe-kingspan-local`

Para IA assistiva de planta baixa, use somente OpenAI API nesta entrega:

```txt
AI_PLAN_EXTRACT_ENABLED=true
AI_PLAN_EXTRACT_PROVIDER_ORDER=openai
OPENAI_API_KEY=...
AI_OPENAI_MODEL=gpt-4o-mini
AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER=3
AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP=5
AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT=50
AI_PLAN_EXTRACT_MAX_FILE_MB=8
AI_PLAN_EXTRACT_CACHE_TTL_HOURS=24
AI_RATE_LIMIT_SALT=valor_secreto_forte
```

`OPENAI_API_KEY` é server-side. Nunca crie `NEXT_PUBLIC_OPENAI_API_KEY`, nunca exponha a chave no frontend, em logs ou respostas de API. Assinatura ChatGPT não configura automaticamente a API deste app; é preciso uma chave de API da plataforma OpenAI.

Veja [docs/setup-ai-and-sinapi.md](docs/setup-ai-and-sinapi.md) para setup completo de OpenAI, Vercel, limites diários e SINAPI.

### Slack GitHub Review Bridge

Use `/lucas-review` in Slack to create a `Lucas Review` comment on a GitHub PR.

See [docs/slack-github-review-bridge.md](docs/slack-github-review-bridge.md).

## O Que O App Faz

- inicia estudos por planta baixa, medidas manuais ou exemplo;
- mantém revisão humana antes de aplicar dados extraídos por IA;
- calcula geometria, áreas, materiais, painéis e estrutura do fluxo A-frame existente;
- suporta métodos modulares adicionais em modo preliminar;
- importa bases de preço controladas, incluindo SINAPI ou base normalizada equivalente;
- sugere vínculos entre quantitativos e composições existentes sem inventar preço;
- gera orçamento preliminar revisável com fonte, data-base, unidade, confiança e pendências;
- salva no LocalStorage e permite importar/exportar JSON.

## IA Assistiva

A IA é opcional, sob demanda e limitada por cota diária. Ela pode ler planta baixa em PDF/imagem quando o modelo OpenAI configurado suportar visão/documento, extrair campos preliminares e sugerir pendências.

A IA nunca deve:

- inventar preço;
- criar composição SINAPI;
- inventar H/H, consumo, perda ou BDI;
- aprovar orçamento;
- aplicar método construtivo incerto automaticamente;
- substituir revisão humana.

## SINAPI

Não há crawler SINAPI nesta entrega. O usuário deve importar arquivo oficial, ZIP oficial, CSV/XLSX/JSON ou base normalizada equivalente.

Enquanto não houver banco externo configurado, bases importadas persistem no modelo atual do app: project store, export/import JSON, `budgetAssistant.priceSources`, `budgetAssistant.serviceCompositions` e coleções técnicas existentes. Arquivos SINAPI não devem ser gravados no filesystem runtime da Vercel/serverless.

Preço `0`, vazio ou ausente nunca entra como preço válido revisado.

## Documentação

- [docs/product-experience.md](docs/product-experience.md): direção de produto e experiência.
- [docs/onboarding-ux.md](docs/onboarding-ux.md): fluxo guiado de entrada.
- [docs/setup-ai-and-sinapi.md](docs/setup-ai-and-sinapi.md): variáveis locais, Vercel, OpenAI API e SINAPI.
- [docs/sinapi-integration.md](docs/sinapi-integration.md): regras da base SINAPI controlada.
- [docs/AI_PLAN_EXTRACT.md](docs/AI_PLAN_EXTRACT.md): contrato técnico da extração de planta por IA.
- [docs/budget-assistant.md](docs/budget-assistant.md): Assistente de orçamento e revisão humana.

## Limitações

Esta ferramenta gera estudo e orçamento preliminar. Não substitui projeto estrutural, projeto arquitetônico, ART/RRT, aprovação municipal, sondagem, cálculo de fundações, verificação de vento, ligações metálicas, orçamento formal ou validação técnica de fornecedor.

## Validação

```bash
npm run lint
npm run test
npm run build
```
