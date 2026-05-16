# Free-cloud AI Routing

## Status

Este documento define a política operacional do ciclo `#182`. A resolução Free/Pro vive em `src/lib/ai/mode.ts`; o roteador contratual de tarefas vive em `src/lib/ai/free-cloud-router.ts`. Gemini já atua como primeira leitura visual no modo `free-cloud`; OpenRouter Free atua como segunda leitura visual/comparação quando configurado e quando o tipo de arquivo for suportado pelo modelo selecionado.

## Objetivo

Permitir uso pessoal e testes com custo zero usando providers cloud gratuitos, sem IA local e sem fallback pago automático. OpenAI permanece disponível em standby para modo pago explícito, escala futura ou comparação controlada.

Fluxo de produto:

1. IA extrai ou sugere.
2. Sistema valida schema, compara e calcula.
3. Usuário revisa.
4. Divergências viram `pendingReason`.
5. Nada entra no projeto ou no orçamento sem revisão humana.

## Modos

| Variável | Valor | Regra |
| --- | --- | --- |
| `AI_MODE` | `free-cloud` | Modo padrão deste ciclo. Não pode chamar OpenAI nem provider pago. |
| `AI_PAID_FALLBACK_ENABLED` | `false` | Padrão seguro. Sem fallback automático para OpenAI ou provider pago. |
| `AI_MODE` | `paid` | Modo Pro/OpenAI explícito. Usa `OPENAI_API_KEY` e `AI_OPENAI_MODEL_PREMIUM` quando configurado; caso contrário usa `AI_OPENAI_MODEL`. |

OpenAI não deve ser removido. A chave `OPENAI_API_KEY` continua server-side e só pode ser usada quando o modo pago estiver explicitamente habilitado.

## Providers Por Tarefa

| Tarefa | Provider alvo | Variavel |
| --- | --- | --- |
| Análise visual principal de planta | Gemini Free | `AI_PLAN_PRIMARY_PROVIDER=gemini` |
| Segunda leitura visual/comparação | OpenRouter Free | `AI_PLAN_REVIEW_PROVIDER=openrouter` |
| Resumo textual e pendências | Groq Free | `AI_TEXT_PROVIDER=groq` |
| Fallback textual opcional | Cerebras ou SambaNova Free | `AI_TEXT_FALLBACK_PROVIDER=cerebras` ou `sambanova` |
| Modo Pro explícito | OpenAI | somente com `AI_MODE=paid` |

OpenRouter deve usar apenas modelos gratuitos no modo `free-cloud`. Neste contrato inicial, OpenRouter é tratado como segunda leitura visual sem suporte PDF genérico; suporte PDF dependerá do modelo/rota em PR futuro. No modo `free-cloud`, `OPENROUTER_PLAN_REVIEW_MODEL` é obrigatório para OpenRouter e o router aceita IDs de modelo com sufixo `:free` ou o roteador gratuito explícito `openrouter/free`. Se não houver modelo gratuito compatível com a tarefa, a extração primária com Gemini continua e a segunda leitura fica marcada como indisponível/pendente.

Modelos configuráveis por provider:

- `GEMINI_MODEL`
- `OPENROUTER_PLAN_REVIEW_MODEL`
- `GROQ_TEXT_MODEL`
- `CEREBRAS_TEXT_MODEL`
- `SAMBANOVA_TEXT_MODEL`
- `AI_OPENAI_MODEL` para OpenAI em modo pago explícito
- `AI_OPENAI_MODEL_PREMIUM` como modelo preferencial do Modo Pro explícito, quando configurado

## Variáveis De Ambiente

```env
AI_MODE=free-cloud
AI_PAID_FALLBACK_ENABLED=false
AI_PLAN_PRIMARY_PROVIDER=gemini
AI_PLAN_REVIEW_PROVIDER=openrouter
AI_TEXT_PROVIDER=groq
AI_TEXT_FALLBACK_PROVIDER=cerebras

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FREE_TIER_NOTICE=true
OPENROUTER_API_KEY=
OPENROUTER_PLAN_REVIEW_MODEL=openrouter/free
GROQ_API_KEY=
GROQ_TEXT_MODEL=llama-3.1-8b-instant
CEREBRAS_API_KEY=
CEREBRAS_TEXT_MODEL=
SAMBANOVA_API_KEY=
SAMBANOVA_TEXT_MODEL=

OPENAI_API_KEY=
AI_OPENAI_MODEL=gpt-4o-mini
AI_OPENAI_MODEL_PREMIUM=gpt-5.4-mini
```

Regras:

- Todas as chaves ficam somente no servidor.
- Nunca criar `NEXT_PUBLIC_GEMINI_API_KEY`, `NEXT_PUBLIC_OPENROUTER_API_KEY`, `NEXT_PUBLIC_GROQ_API_KEY`, `NEXT_PUBLIC_CEREBRAS_API_KEY`, `NEXT_PUBLIC_SAMBANOVA_API_KEY` ou `NEXT_PUBLIC_OPENAI_API_KEY`.
- Nunca logar chaves.
- Nunca retornar chaves em resposta de API.
- Nunca colocar chaves em issue, PR, screenshot, fixture ou teste.

## Limites Dos Providers Gratuitos

Modo free-cloud não significa disponibilidade garantida. Cada provider pode alterar limites, modelos, regiões, políticas de dados ou disponibilidade sem aviso dentro do app.

Comportamento esperado:

- respeitar cache por hash de arquivo;
- manter rate limit por usuário/IP/global;
- mostrar status de produto seguro na UI;
- quando o provider gratuito falhar ou atingir limite, voltar para preenchimento manual;
- não acionar OpenAI automaticamente para "salvar" a análise.

## Resumo Textual Gratuito

O resumo textual vive em `src/lib/ai/text-providers.ts` e atua como camada auxiliar de revisão. Ele recebe um `PlanExtractResult` já validado e, opcionalmente, o resumo de comparação multi-modelo. A saída é separada do JSON estruturado:

- `text`;
- `detected`;
- `lowConfidence`;
- `divergences`;
- `pendingQuestions`;
- `nextSteps`;
- `provider`, `model` e `tokens` quando houver provider.

Regras:

- Groq é o provider textual principal (`AI_TEXT_PROVIDER=groq`).
- Cerebras ou SambaNova podem atuar como fallback textual.
- Se todos falharem ou estiverem sem chave, o app usa resumo determinístico local.
- O resumo nunca altera `PlanExtractResult`.
- Providers textuais não recebem imagem/PDF e não são usados para preço, SINAPI, BDI, H/H, consumo, perda ou aprovação.

## Privacidade

Plantas enviadas para providers cloud podem conter dados sensíveis de obra. A UI e a documentação devem deixar claro que:

- a chamada é sob demanda;
- o arquivo sai do navegador para o servidor do app e depois para o provider configurado;
- dados extraídos são preliminares;
- revisão humana continua obrigatória;
- custo zero não elimina obrigação de ler termos, retenção e políticas do provider.

## Guard Rails

No modo `free-cloud`, o router deve bloquear:

- OpenAI;
- modelos pagos do OpenRouter;
- fallback pago automatico;
- IA local/Ollama/LM Studio;
- chamadas externas em testes unitários;
- qualquer resposta que tente criar preço, SINAPI, H/H, consumo, perda, BDI ou aprovação.

OpenAI em standby deve continuar bloqueado até uma decisão explícita habilitar modo pago.

## Testes Esperados Nos Próximos PRs

- `AI_MODE=free-cloud` não chama OpenAI.
- `AI_PAID_FALLBACK_ENABLED=false` bloqueia fallback pago.
- Provider sem chave retorna fallback manual seguro.
- Provider gratuito com limite/erro retorna pendência, não aplica dados.
- Cache hit não consome quota.
- Testes unitários usam mocks e não chamam APIs externas.

## Rollout

1. Documentar política e envs.
2. Criar router free-cloud com bloqueio contra provider pago.
3. Implementar Gemini Free para análise visual principal.
4. Implementar OpenRouter Free para segunda leitura/comparação.
5. Implementar providers textuais gratuitos.
6. Mostrar modo/status/fallback manual na UI.
7. Medir precisão com fixtures sanitizadas.

## Fora Do Escopo

- Remover OpenAI.
- Usar IA local.
- Chamar provider pago automaticamente.
- Alterar orçamento, SINAPI, 3D, export, Slack ou GitHub Actions.
- Transformar resultado de IA em orçamento final.
