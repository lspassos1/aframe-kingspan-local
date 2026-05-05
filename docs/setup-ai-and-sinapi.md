# Setup De IA E SINAPI

Este guia explica onde configurar OpenAI API, limites da IA e importação SINAPI.

## Desenvolvimento Local

1. Copie o exemplo:

```bash
cp .env.example .env.local
```

2. Configure a IA somente se quiser testar upload assistido:

```txt
AI_PLAN_EXTRACT_ENABLED=true
AI_PLAN_EXTRACT_PROVIDER_ORDER=openai
OPENAI_API_KEY=sk-...
AI_OPENAI_MODEL=gpt-4o-mini
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

Não coloque `OPENAI_API_KEY` em variável pública. Nunca use `NEXT_PUBLIC_OPENAI_API_KEY`.

## OpenAI API

Use uma chave da plataforma OpenAI. Assinatura ChatGPT Plus/Team/Enterprise não configura automaticamente a API deste app.

Regras:

- `OPENAI_API_KEY` fica somente no servidor.
- Não logar a chave.
- Não retornar a chave em API.
- Não hardcodar a chave.
- Não expor em componente client.

Provider oficial nesta entrega:

```txt
AI_PLAN_EXTRACT_PROVIDER_ORDER=openai
AI_OPENAI_MODEL=gpt-4o-mini
```

## Ativar Ou Desativar IA

IA desligada:

```txt
AI_PLAN_EXTRACT_ENABLED=false
```

IA ligada:

```txt
AI_PLAN_EXTRACT_ENABLED=true
```

Mesmo com a flag ligada, upload assistido precisa de `OPENAI_API_KEY` no servidor. Configure `AI_OPENAI_MODEL` explicitamente para controle operacional; se ele estiver ausente, o backend usa o padrão OpenAI atual e o checklist mostra `Modelo: ausente`.

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
2. `AI_PLAN_EXTRACT_PROVIDER_ORDER=openai`.
3. `OPENAI_API_KEY` existe no ambiente do servidor.
4. `AI_OPENAI_MODEL` está configurado explicitamente, se você quiser controle operacional do modelo. Sem isso, o backend usa o padrão OpenAI atual e o checklist mostra `Modelo: ausente`.
5. O deployment foi refeito depois da mudança.
6. O usuário está autenticado, se anônimo estiver desabilitado.
7. O arquivo é PNG, JPG, WebP ou PDF e respeita `AI_PLAN_EXTRACT_MAX_FILE_MB`.
8. O limite diário não foi atingido.

Se estiver em Vercel, confira se a variável foi adicionada ao mesmo ambiente do preview/produção que está sendo testado.

No app, abra `Ajuda` e confira o checklist operacional:

- `IA: ativa/desligada`;
- `Provider: OpenAI`;
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
- Não use variável pública para segredo.
- Não trate preço zerado como preço válido.
- Não chame orçamento preliminar de orçamento final.
