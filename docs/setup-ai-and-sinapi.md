# Setup De IA E SINAPI

Este guia explica onde configurar IA, limites da extração e importação SINAPI. O contrato atual não cria novas envs: o modo free-cloud usa somente as variáveis já cadastradas para Gemini, OpenRouter, Groq, Cerebras e SambaNova. OpenAI permanece em standby para modo pago explícito.

## Desenvolvimento Local

1. Copie o exemplo:

```bash
cp .env.example .env.local
```

2. Configure a IA somente se quiser testar upload assistido em modo free-cloud:

```txt
AI_PLAN_EXTRACT_ENABLED=true
AI_MODE=free-cloud
AI_PAID_FALLBACK_ENABLED=false
AI_PLAN_PRIMARY_PROVIDER=gemini
AI_PLAN_REVIEW_PROVIDER=openrouter
AI_TEXT_PROVIDER=groq
AI_TEXT_FALLBACK_PROVIDER=cerebras
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FREE_TIER_NOTICE=true
OPENROUTER_API_KEY=...
OPENROUTER_PLAN_REVIEW_MODEL=openrouter/free
GROQ_API_KEY=...
GROQ_TEXT_MODEL=llama-3.1-8b-instant
CEREBRAS_API_KEY=...
CEREBRAS_TEXT_MODEL=...
SAMBANOVA_API_KEY=...
SAMBANOVA_TEXT_MODEL=...
AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER=3
AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP=5
AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT=50
AI_PLAN_EXTRACT_MAX_FILE_MB=8
AI_PLAN_EXTRACT_CACHE_TTL_HOURS=24
AI_RATE_LIMIT_SALT=valor_secreto_forte
```

3. Reinicie o servidor local depois de alterar `.env.local`:

```bash
npm run dev
```

## Vercel

Em Vercel, configure variáveis em:

```txt
Project Settings -> Environment Variables
```

Configure os ambientes necessários: Preview, Production ou Development. Depois de alterar variável server-side, faça redeploy do deployment afetado.

Não coloque chaves de IA em variável pública. Nunca use `NEXT_PUBLIC_OPENAI_API_KEY` ou `NEXT_PUBLIC_*_API_KEY` para providers privados.

## OpenAI API Em Standby

Use uma chave da plataforma OpenAI. Assinatura ChatGPT Plus/Team/Enterprise não configura automaticamente a API deste app.

Regras:

- `OPENAI_API_KEY` fica somente no servidor.
- Não logar a chave.
- Não retornar a chave em API.
- Não hardcodar a chave.
- Não expor em componente client.

Modo Pro/OpenAI explícito:

```txt
AI_MODE=paid
OPENAI_API_KEY=sk-...
AI_OPENAI_MODEL=gpt-4o-mini
AI_OPENAI_MODEL_PREMIUM=gpt-5.4-mini
```

`AI_OPENAI_MODEL_PREMIUM` fica reservado para comparação futura e não é chamado automaticamente agora.

## Modo Free-cloud

O ciclo `#182` define `AI_MODE=free-cloud` para uso pessoal/testes sem custo. O router separa análise visual, segunda leitura e resumo textual por tarefa, mantendo OpenAI em standby para modo pago explícito. Não crie novas envs nem variações de modelo/provider.

```txt
AI_MODE=free-cloud
AI_PAID_FALLBACK_ENABLED=false
AI_PLAN_PRIMARY_PROVIDER=gemini
AI_PLAN_REVIEW_PROVIDER=openrouter
AI_TEXT_PROVIDER=groq
AI_TEXT_FALLBACK_PROVIDER=cerebras
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FREE_TIER_NOTICE=true
OPENROUTER_API_KEY=...
OPENROUTER_PLAN_REVIEW_MODEL=openrouter/free
GROQ_API_KEY=...
GROQ_TEXT_MODEL=llama-3.1-8b-instant
CEREBRAS_API_KEY=...
CEREBRAS_TEXT_MODEL=...
SAMBANOVA_API_KEY=...
SAMBANOVA_TEXT_MODEL=...
```

Regras:

- OpenAI permanece em standby; não remova `OPENAI_API_KEY`.
- `AI_PAID_FALLBACK_ENABLED=false` significa que OpenAI e providers pagos não podem ser usados como fallback automático.
- Chaves de Gemini, OpenRouter, Groq, Cerebras e SambaNova são server-side. Nunca use `NEXT_PUBLIC_*` para essas chaves.
- Groq/Cerebras/SambaNova são auxiliares textuais: resumem pendências e próximos passos, mas não alteram o JSON estruturado da análise.
- Limites gratuitos podem mudar por provider. Quando todos falharem ou atingirem limite, o app deve manter fallback manual claro.

Veja `docs/free-cloud-ai-routing.md`.

## Ativar Ou Desativar IA

IA desligada:

```txt
AI_PLAN_EXTRACT_ENABLED=false
```

IA ligada:

```txt
AI_PLAN_EXTRACT_ENABLED=true
```

Mesmo com a flag ligada, upload assistido precisa do provider do modo atual configurado no servidor. Em `AI_MODE=free-cloud`, configure Gemini como principal e OpenRouter/Groq conforme a lista acima. Em `AI_MODE=paid`, configure `OPENAI_API_KEY` e `AI_OPENAI_MODEL`.

## Limites Diários

Variáveis:

- `AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER=3`
- `AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP=5`
- `AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT=50`

Cache:

- `AI_PLAN_EXTRACT_CACHE_TTL_HOURS=24`
- `AI_PLAN_EXTRACT_CACHE_VERSION` invalida cache manualmente quando prompt/schema/modelo mudar.

Rate limit:

- `AI_RATE_LIMIT_SALT` deve ser forte e secreto.
- Em produção, use storage persistente, como Upstash Redis REST.

## Diagnóstico: Upload Ou IA Não Aparece

Verifique:

1. `AI_PLAN_EXTRACT_ENABLED=true`.
2. `AI_MODE=free-cloud` ou `AI_MODE=paid`.
3. Em free-cloud: `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_PLAN_REVIEW_MODEL`, `GROQ_API_KEY` e `GROQ_TEXT_MODEL` existem no servidor conforme o fluxo desejado.
4. Em modo pago: `OPENAI_API_KEY` e `AI_OPENAI_MODEL` existem no servidor.
5. O deployment foi refeito depois da mudança.
6. O usuário está autenticado, se anônimo estiver desabilitado.
7. O arquivo é PNG, JPG, WebP ou PDF e respeita `AI_PLAN_EXTRACT_MAX_FILE_MB`.
8. O limite diário não foi atingido.

Se estiver em Vercel, confira se a variável foi adicionada ao mesmo ambiente do preview/produção que está sendo testado.

No app, abra `Ajuda` e confira o checklist operacional atual:

- `IA: ativa/desligada`;
- `Provider: Gemini/OpenRouter/Groq ou OpenAI`, conforme o modo;
- `Modelo: configurado/ausente`;
- `Limite diário: disponível`;
- `SINAPI: base ausente/base importada`;
- `UF`, `Referência` e `Regime`.

O checklist não exibe segredo. Ele mostra apenas booleans e metadados seguros para diagnosticar configuração.

## Importar SINAPI

Não há crawler. Importe arquivo oficial, ZIP oficial, CSV/XLSX/JSON ou base normalizada equivalente.

Fluxo esperado:

1. Abrir o Assistente de orçamento/Base de preços.
2. Selecionar arquivo.
3. Informar origem, UF, referência/data-base e regime quando aplicável.
4. Revisar status de importação.
5. Manter itens `zeroed`, `missing`, `requires_review`, `invalid_unit` ou `out_of_region` como pendentes.
6. Exportar o projeto JSON para preservar a base junto do estudo.

## Diagnóstico: Base SINAPI Ausente

Sinais de base ausente:

- checklist operacional mostra `SINAPI: base ausente`;
- não há fontes `sinapi` em `budgetAssistant.priceSources`;
- não há composições importadas em `budgetAssistant.serviceCompositions`;
- matching retorna nenhum candidato para UF/referência/regime selecionados.

Solução:

1. importar a base;
2. conferir UF;
3. conferir referência/data-base;
4. conferir regime;
5. conferir unidades e preços;
6. salvar/exportar JSON do projeto.

## Segurança

- Não envie `.env.local` para git.
- Não cole chave OpenAI em issue, PR, print ou log.
- Não cole chave Gemini, OpenRouter, Groq, Cerebras ou SambaNova em issue, PR, print ou log.
- Não use variável pública para segredo.
- Não trate preço zerado como preço válido.
- Não chame orçamento preliminar de orçamento final.
