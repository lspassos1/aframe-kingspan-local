# Extração De Planta Com OpenAI API

Este documento cobre a configuração técnica da extração assistida de planta baixa. A feature é opcional, server-side e desligada por padrão em ambientes sem OpenAI configurado.

## Objetivo

O fluxo lê imagem ou PDF de planta baixa e retorna JSON preliminar com campos legados simples e blocos avançados de análise. Os campos legados mantêm compatibilidade com o preenchimento atual; os blocos avançados carregam fonte, confiança, evidência, pendências e perguntas para os próximos passos de takeoff.

O resultado sempre passa por revisão humana antes de ser aplicado ao projeto. A extração não substitui projeto arquitetônico, projeto estrutural, ART/RRT, aprovação municipal, sondagem, orçamento formal ou validação técnica de fornecedor.

## Provider Oficial

Nesta entrega, o provider oficial é somente OpenAI API.

```txt
AI_PLAN_EXTRACT_PROVIDER_ORDER=openai
OPENAI_API_KEY=...
AI_OPENAI_MODEL=gpt-4o-mini
```

A abstração interna de providers pode existir por compatibilidade, mas a configuração documentada, os testes novos e a UI operacional não devem exigir Gemini, Groq, OpenRouter ou endpoint genérico.

`OPENAI_API_KEY` deve ser lida apenas no servidor. Nunca use `NEXT_PUBLIC_OPENAI_API_KEY`; variáveis com prefixo `NEXT_PUBLIC_` entram no bundle do navegador.

## Variáveis De Ambiente

Copie `.env.example` para `.env.local` no desenvolvimento local. Em Vercel, configure as mesmas variáveis em Project Settings > Environment Variables.

Obrigatórias para habilitar:

- `AI_PLAN_EXTRACT_ENABLED=true`
- `AI_PLAN_EXTRACT_PROVIDER_ORDER=openai`
- `OPENAI_API_KEY`
- `AI_OPENAI_MODEL=gpt-4o-mini`
- `AI_RATE_LIMIT_SALT` com valor forte e único em produção

Limites e segurança:

- `AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER`: limite diário por usuário autenticado.
- `AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP`: limite diário por IP quando uso anônimo estiver habilitado.
- `AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT`: limite diário global do projeto.
- `AI_PLAN_EXTRACT_MAX_FILE_MB`: tamanho máximo do upload. Padrão recomendado: `8`.
- `AI_ALLOW_ANONYMOUS_PLAN_EXTRACT`: manter `false` em produção salvo decisão explícita.
- `AI_RATE_LIMIT_FAIL_OPEN`: manter `false` em produção.
- `AI_RATE_LIMIT_REDIS_TIMEOUT_MS`: timeout para Upstash Redis REST.
- `AI_TRUST_PROXY_IP_HEADERS`: usar `true` somente atrás de proxy confiável.
- `AI_PLAN_EXTRACT_CACHE_TTL_HOURS`: cache por hash de arquivo/modelo. Padrão: `24`.
- `AI_PLAN_EXTRACT_CACHE_VERSION`: versão manual para invalidar cache quando prompt, schema ou modelo mudarem.

Armazenamento opcional de rate limit:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Sem Upstash, o desenvolvimento pode usar memória local. Em produção, configure storage persistente antes de abrir a feature.

## Regras De Segurança

- Não expor chave no frontend.
- Não expor chave em logs.
- Não retornar chave em resposta de API.
- Não colocar chave hardcoded no código.
- Validar JSON com schema antes de usar.
- Usar IA apenas sob demanda.
- Respeitar limite diário.
- Usar cache por hash de arquivo quando aplicável.

## O Que A IA Pode Fazer

- Ler planta baixa em PDF/imagem quando o modelo configurado suportar visão/documento.
- Extrair campos preliminares da planta.
- Retornar blocos estruturados de documento, escala, localização, edificação, ambientes, paredes, aberturas, acabamentos, cobertura, fundação preliminar, elétrica, hidráulica e áreas externas.
- Gerar `questions` quando faltar escala, cidade/UF, pé-direito, cobertura, fundação, elétrica, hidráulica ou base de preço.
- Explicar pendências e incertezas.
- Sugerir vínculos entre quantitativos e composições existentes em fluxos específicos.

## O Que A IA Nunca Faz

- Inventar preço.
- Criar composição SINAPI.
- Inventar H/H, consumo, perda ou BDI.
- Aprovar orçamento.
- Substituir revisão humana.
- Aplicar método construtivo incerto automaticamente.

## Schema De Retorno

O retorno usa `version: "1.0"` para compatibilidade, mas pode incluir blocos avançados:

- `extractionStatus`: `complete`, `partial` ou `insufficient`.
- `fieldConfidence` e `fieldEvidence` para campos legados.
- `document`, `scale`, `location`, `lot`, `building`, `rooms`, `walls`, `openings`, `floorFinishes`, `wallFinishes`, `painting`, `ceiling`, `roof`, `foundation`, `structure`, `electrical`, `plumbing`, `fixtures` e `exterior`.
- `quantitySeeds` para quantidades preliminares revisáveis.
- `questions` para dados que o usuário precisa responder antes do orçamento.
- `extractionWarnings` para alertas estruturados.

Todo valor avançado retornado pela IA deve ter `value`, `unit`, `confidence`, `evidence`, `source`, `requiresReview` e `pendingReason` quando houver dúvida ou estimativa. Fontes geradas pela IA ou pelo sistema (`visible`, `calculated`, `estimated_rule`, `ai_visible`, `system_calculated`, `rule_estimated`) sempre exigem revisão humana. Dados de baixa confiança, confiança desconhecida ou estimados por regra exigem pendência explícita. `QuantitySeed` não pode carregar preço, composição SINAPI, H/H, consumo, perda, BDI ou aprovação.

## Fluxo Esperado

1. Usuário autenticado envia PNG, JPG, WebP ou PDF; se `AI_ALLOW_ANONYMOUS_PLAN_EXTRACT=true`, anônimos usam limite por IP.
2. O servidor valida tipo e tamanho.
3. O cache por hash é consultado antes de consumir quota.
4. Em cache miss, o rate limit consome quota diária por usuário/IP/global.
5. OpenAI processa o arquivo.
6. O retorno é validado por Zod como `PlanExtractResult`.
7. A UI mostra campos, confiança, incertezas e alertas.
8. O usuário escolhe quais campos aplicar.
9. Dados de baixa confiança ficam desmarcados por padrão.

Nenhum dado extraído deve entrar no projeto sem ação do usuário.

## Deploy Local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Para testar sem custo, mantenha `AI_PLAN_EXTRACT_ENABLED=false`. Para testar com OpenAI real, configure limites pequenos:

```txt
AI_PLAN_EXTRACT_ENABLED=true
AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER=3
AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT=10
AI_PLAN_EXTRACT_PROVIDER_ORDER=openai
OPENAI_API_KEY=...
AI_OPENAI_MODEL=gpt-4o-mini
```

Assinatura ChatGPT não configura automaticamente a API do app. A chave precisa vir da plataforma OpenAI e ficar somente em `.env.local` ou nas variáveis server-side da Vercel.

## Deploy Vercel

1. Configure Clerk e GitHub feedback como nas demais variáveis do projeto.
2. Configure as variáveis `AI_*` e `OPENAI_API_KEY` no ambiente desejado.
3. Configure `AI_RATE_LIMIT_SALT` com valor forte e secreto.
4. Configure storage persistente de rate limit para produção.
5. Faça redeploy após alterar variáveis server-side.
6. Mantenha `AI_PLAN_EXTRACT_ENABLED=false` até validar preview.
7. Habilite primeiro em Preview, depois em Production.

## Validação Antes De Liberar

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
- resposta JSON inválida deve falhar sem aplicar dados;
- cache hit deve retornar resultado sem consumir quota;
- campos extraídos aparecem para revisão antes de aplicar.

## Limites Técnicos

A extração é heurística e pode errar leitura de cotas, escala, ambientes, pavimentos e aberturas. Use como pré-preenchimento e checklist de revisão, nunca como verdade técnica.
