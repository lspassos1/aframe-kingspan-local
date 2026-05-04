# AI plan extraction

Este documento cobre a configuracao da extracao assistida de planta baixa. A feature e opcional, server-side e deve ficar desligada por padrao em ambientes sem provider configurado.

## Objetivo

O fluxo ajuda a ler uma imagem ou PDF de planta baixa e retornar um JSON preliminar com campos como metodo construtivo sugerido, cidade/estado, dimensoes do lote, dimensoes da casa, pavimentos, pe-direito, portas, janelas, observacoes, incertezas e alertas.

O resultado deve sempre passar por revisao humana antes de ser aplicado ao projeto. A extracao nao substitui projeto arquitetonico, projeto estrutural, ART/RRT, aprovacao municipal, sondagem, orcamento formal ou validacao tecnica de fornecedor.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` no desenvolvimento local. Em Vercel, configure as mesmas variaveis como Environment Variables do projeto.

Obrigatorias para habilitar:

- `AI_PLAN_EXTRACT_ENABLED=true`
- ao menos um provider com chave e modelo configurados
- `AI_RATE_LIMIT_SALT` com valor forte e unico em producao

Limites e seguranca:

- `AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER`: limite diario por usuario autenticado.
- `AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP`: limite diario por IP quando uso anonimo estiver habilitado.
- `AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT`: limite diario global do projeto.
- `AI_PLAN_EXTRACT_MAX_FILE_MB`: tamanho maximo do upload. Padrao recomendado: `8`.
- `AI_ALLOW_ANONYMOUS_PLAN_EXTRACT`: manter `false` em producao salvo decisao explicita.
- `AI_RATE_LIMIT_FAIL_OPEN`: manter `false` em producao.
- `AI_RATE_LIMIT_REDIS_TIMEOUT_MS`: timeout para Upstash Redis REST.
- `AI_TRUST_PROXY_IP_HEADERS`: usar `true` somente quando a aplicacao esta atras de proxy confiavel que controla `x-forwarded-for`/`x-real-ip`.

Armazenamento opcional de rate limit:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Sem Upstash, o desenvolvimento pode usar memoria local. Em producao, configure Upstash ou outro storage equivalente antes de abrir a feature.

## Providers

Ordem de tentativa:

```txt
AI_PLAN_EXTRACT_PROVIDER_ORDER=openai,openrouter,groq,generic
```

Providers suportados:

- OpenAI: `OPENAI_API_KEY`, `AI_OPENAI_MODEL`.
- OpenRouter: `OPENROUTER_API_KEY`, `AI_OPENROUTER_MODEL`.
- Groq: `GROQ_API_KEY`, `AI_GROQ_MODEL`.
- Generico OpenAI-compatible: `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`.

O provider generico precisa aceitar o mesmo formato de `chat/completions` usado no app. Antes de usar em producao, valide manualmente com uma planta simples e confira se o JSON retorna dentro do schema.

Groq deve ser usado com cuidado para imagem/PDF. Se o modelo configurado nao suportar visao ou arquivo, ele nao deve ser tratado como provider valido para uploads visuais.

## Privacidade e custo

Ao usar a extracao, a planta enviada pelo usuario e encaminhada ao provider configurado. Isso pode incluir desenho arquitetonico, endereco, medidas e outras informacoes sensiveis.

Antes de habilitar em producao:

- confirme contrato, termos e retencao de dados do provider escolhido;
- informe o usuario de que a planta sera processada por terceiros;
- mantenha `AI_PLAN_EXTRACT_MAX_FILE_MB` baixo para controlar custo;
- mantenha limites diarios pequenos no inicio;
- monitore erros e uso por provider;
- nao registre conteudo bruto da planta em logs.

O app deve registrar apenas metadados operacionais seguros, como provider usado, modelo, status, tokens quando disponiveis, escopo do rate limit e erro tecnico resumido.

## Fluxo esperado

1. Usuario autenticado envia PNG, JPG, WebP ou PDF; se `AI_ALLOW_ANONYMOUS_PLAN_EXTRACT=true`, usuario anonimo tambem pode enviar usando limite por IP.
2. O servidor valida tipo e tamanho.
3. O rate limit consome quota diaria por usuario/IP/global.
4. O provider chain tenta os providers configurados na ordem definida.
5. O retorno e validado por Zod como `PlanExtractResult`.
6. A UI mostra campos, confianca, incertezas e alertas.
7. O usuario escolhe quais campos aplicar.
8. Dados de baixa confianca ficam desmarcados por padrao.

Nenhum dado extraido deve entrar no projeto sem acao do usuario.

## Deploy local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Para testar sem custo, mantenha `AI_PLAN_EXTRACT_ENABLED=false`. Para testar com provider real, configure apenas um provider por vez e use limites pequenos:

```txt
AI_PLAN_EXTRACT_ENABLED=true
AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER=3
AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT=10
AI_PLAN_EXTRACT_PROVIDER_ORDER=openai
OPENAI_API_KEY=...
AI_OPENAI_MODEL=gpt-4o-mini
```

## Deploy Vercel

1. Configure Clerk e GitHub feedback como nas demais variaveis do projeto.
2. Configure as variaveis `AI_*` no ambiente desejado.
3. Configure `AI_RATE_LIMIT_SALT` com valor forte e secreto.
4. Configure Upstash Redis REST para producao.
5. Mantenha `AI_PLAN_EXTRACT_ENABLED=false` ate validar preview.
6. Habilite primeiro em Preview, depois em Production.

## Validacao antes de liberar

Rode:

```bash
npm run lint
npm run test
npm run build
```

Valide manualmente:

- arquivo vazio deve falhar;
- tipo nao suportado deve falhar;
- arquivo acima do limite deve falhar;
- usuario sem login deve falhar quando anonimo estiver desabilitado;
- retorno invalido do provider deve falhar sem aplicar dados;
- campos extraidos aparecem para revisao antes de aplicar.

## Limites tecnicos

A extracao e heuristica e pode errar leitura de cotas, escala, ambientes, pavimentos e aberturas. Use como pre-preenchimento e checklist de revisao, nunca como verdade tecnica.
