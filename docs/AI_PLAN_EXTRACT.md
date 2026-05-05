# AI plan extraction

Este documento cobre a configuração da extração assistida de planta baixa. A feature é opcional, server-side e deve ficar desligada por padrão em ambientes sem provider configurado.

## Objetivo

O fluxo ajuda a ler uma imagem ou PDF de planta baixa e retornar um JSON preliminar com campos como método construtivo sugerido, cidade/estado, dimensões do lote, dimensões da casa, pavimentos, pé-direito, portas, janelas, observações, incertezas e alertas.

O resultado deve sempre passar por revisão humana antes de ser aplicado ao projeto. A extração não substitui projeto arquitetônico, projeto estrutural, ART/RRT, aprovação municipal, sondagem, orçamento formal ou validação técnica de fornecedor.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` no desenvolvimento local. Em Vercel, configure as mesmas variaveis como Environment Variables do projeto.

Obrigatórias para habilitar:

- `AI_PLAN_EXTRACT_ENABLED=true`
- ao menos um provider com chave e modelo configurados
- `AI_RATE_LIMIT_SALT` com valor forte e único em produção

Limites e segurança:

- `AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER`: limite diário por usuário autenticado.
- `AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP`: limite diário por IP quando uso anônimo estiver habilitado.
- `AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT`: limite diário global do projeto.
- `AI_PLAN_EXTRACT_MAX_FILE_MB`: tamanho máximo do upload. Padrão recomendado: `8`.
- `AI_ALLOW_ANONYMOUS_PLAN_EXTRACT`: manter `false` em produção salvo decisão explícita.
- `AI_RATE_LIMIT_FAIL_OPEN`: manter `false` em produção.
- `AI_RATE_LIMIT_REDIS_TIMEOUT_MS`: timeout para Upstash Redis REST.
- `AI_TRUST_PROXY_IP_HEADERS`: usar `true` somente quando a aplicação está atrás de proxy confiável que controla `x-forwarded-for`/`x-real-ip`.
- `AI_PLAN_EXTRACT_CACHE_TTL_HOURS`: tempo de cache por hash do arquivo/modelo. Padrão: `24`.
- `AI_PLAN_EXTRACT_CACHE_VERSION`: versão manual para invalidar cache quando prompt, schema ou provider mudarem.
- `AI_GROQ_VISION_ENABLED`: habilita Groq para PNG/JPG/WebP somente após confirmar suporte visual do modelo configurado.

Armazenamento opcional de rate limit:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Sem Upstash, o desenvolvimento pode usar memória local. Em produção, configure Upstash ou outro storage equivalente antes de abrir a feature.

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

O provider genérico precisa aceitar o mesmo formato de `chat/completions` usado no app. Antes de usar em produção, valide manualmente com uma planta simples e confira se o JSON retorna dentro do schema.

Groq deve ser usado com cuidado para imagens. Ele não é tratado como provider válido para PDF neste fluxo. Para PNG/JPG/WebP, defina `AI_GROQ_VISION_ENABLED=true` somente depois de confirmar que o modelo configurado suporta entrada visual.

## Privacidade e custo

Ao usar a extração, a planta enviada pelo usuário é encaminhada ao provider configurado. Isso pode incluir desenho arquitetônico, endereço, medidas e outras informações sensíveis.

Antes de habilitar em produção:

- confirme contrato, termos e retenção de dados do provider escolhido;
- informe o usuário de que a planta será processada por terceiros;
- mantenha `AI_PLAN_EXTRACT_MAX_FILE_MB` baixo para controlar custo;
- mantenha limites diários pequenos no início;
- monitore erros e uso por provider;
- não registre conteúdo bruto da planta em logs.

O app deve registrar apenas metadados operacionais seguros, como provider usado, modelo, status, tokens quando disponíveis, escopo do rate limit e erro técnico resumido.

## Fluxo esperado

1. Usuário autenticado envia PNG, JPG, WebP ou PDF; se `AI_ALLOW_ANONYMOUS_PLAN_EXTRACT=true`, usuário anônimo também pode enviar usando limite por IP.
2. O servidor valida tipo e tamanho.
3. O rate limit consome quota diária por usuário/IP/global.
4. O provider chain tenta os providers configurados na ordem definida.
5. O retorno é validado por Zod como `PlanExtractResult`.
6. A UI mostra campos, confiança, incertezas e alertas.
7. O usuário escolhe quais campos aplicar.
8. Dados de baixa confiança ficam desmarcados por padrão.

Nenhum dado extraído deve entrar no projeto sem ação do usuário.

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

1. Configure Clerk e GitHub feedback como nas demais variáveis do projeto.
2. Configure as variáveis `AI_*` no ambiente desejado.
3. Configure `AI_RATE_LIMIT_SALT` com valor forte e secreto.
4. Configure Upstash Redis REST para produção.
5. Mantenha `AI_PLAN_EXTRACT_ENABLED=false` até validar preview.
6. Habilite primeiro em Preview, depois em Production.

## Validação antes de liberar

Rode:

```bash
npm run lint
npm run test
npm run build
```

Valide manualmente:

- arquivo vazio deve falhar;
- tipo não suportado deve falhar;
- arquivo acima do limite deve falhar;
- usuário sem login deve falhar quando anônimo estiver desabilitado;
- retorno inválido do provider deve falhar sem aplicar dados;
- campos extraídos aparecem para revisão antes de aplicar.

## Limites técnicos

A extração é heurística e pode errar leitura de cotas, escala, ambientes, pavimentos e aberturas. Use como pré-preenchimento e checklist de revisão, nunca como verdade técnica.
