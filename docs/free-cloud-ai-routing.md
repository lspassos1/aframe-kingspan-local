# Free-cloud AI Routing

## Status

Este documento define a politica operacional do ciclo `#182`. Este PR nao altera runtime, endpoint ou provider chain. Ate os PRs de router/provider serem entregues, `/api/ai/plan-extract` continua usando o caminho OpenAI existente quando a feature estiver habilitada.

## Objetivo

Permitir uso pessoal e testes com custo zero usando providers cloud gratuitos, sem IA local e sem fallback pago automatico. OpenAI permanece disponivel em standby para modo pago explicito, escala futura ou comparacao controlada.

Fluxo de produto:

1. IA extrai ou sugere.
2. Sistema valida schema, compara e calcula.
3. Usuario revisa.
4. Divergencias viram `pendingReason`.
5. Nada entra no projeto ou no orcamento sem revisao humana.

## Modos

| Variavel | Valor | Regra |
| --- | --- | --- |
| `AI_MODE` | `free-cloud` | Modo padrao deste ciclo. Nao pode chamar OpenAI nem provider pago. |
| `AI_PAID_FALLBACK_ENABLED` | `false` | Padrao seguro. Sem fallback automatico para OpenAI ou provider pago. |
| `AI_PAID_FALLBACK_ENABLED` | `true` | Permitido apenas em modo pago/operacao explicita futura. Deve ser visivel na UI. |

OpenAI nao deve ser removido. A chave `OPENAI_API_KEY` continua server-side e so pode ser usada quando o modo pago estiver explicitamente habilitado.

## Providers Por Tarefa

| Tarefa | Provider alvo | Variavel |
| --- | --- | --- |
| Analise visual principal de planta | Gemini Free | `AI_PLAN_PRIMARY_PROVIDER=gemini` |
| Segunda leitura visual/comparacao | OpenRouter Free | `AI_PLAN_REVIEW_PROVIDER=openrouter` |
| Resumo textual e pendencias | Groq Free | `AI_TEXT_PROVIDER=groq` |
| Fallback textual opcional | Cerebras ou SambaNova Free | `AI_TEXT_FALLBACK_PROVIDER=cerebras` ou `sambanova` |
| Standby pago | OpenAI | somente com `AI_PAID_FALLBACK_ENABLED=true` ou modo pago explicito |

OpenRouter deve usar apenas modelos gratuitos no modo `free-cloud`. Se nao houver modelo gratuito compativel com a tarefa, o app deve retornar fallback manual claro.

## Variaveis De Ambiente

```env
AI_MODE=free-cloud
AI_PAID_FALLBACK_ENABLED=false
AI_PLAN_PRIMARY_PROVIDER=gemini
AI_PLAN_REVIEW_PROVIDER=openrouter
AI_TEXT_PROVIDER=groq
AI_TEXT_FALLBACK_PROVIDER=cerebras

GEMINI_API_KEY=
OPENROUTER_API_KEY=
GROQ_API_KEY=
CEREBRAS_API_KEY=
SAMBANOVA_API_KEY=
```

Regras:

- Todas as chaves ficam somente no servidor.
- Nunca criar `NEXT_PUBLIC_GEMINI_API_KEY`, `NEXT_PUBLIC_OPENROUTER_API_KEY`, `NEXT_PUBLIC_GROQ_API_KEY`, `NEXT_PUBLIC_CEREBRAS_API_KEY`, `NEXT_PUBLIC_SAMBANOVA_API_KEY` ou `NEXT_PUBLIC_OPENAI_API_KEY`.
- Nunca logar chaves.
- Nunca retornar chaves em resposta de API.
- Nunca colocar chaves em issue, PR, screenshot, fixture ou teste.

## Limites Dos Providers Gratuitos

Modo free-cloud nao significa disponibilidade garantida. Cada provider pode alterar limites, modelos, regioes, politicas de dados ou disponibilidade sem aviso dentro do app.

Comportamento esperado:

- respeitar cache por hash de arquivo;
- manter rate limit por usuario/IP/global;
- mostrar provider usado e status seguro na UI;
- quando o provider gratuito falhar ou atingir limite, voltar para preenchimento manual;
- nao acionar OpenAI automaticamente para "salvar" a analise.

## Privacidade

Plantas enviadas para providers cloud podem conter dados sensiveis de obra. A UI e a documentacao devem deixar claro que:

- a chamada e sob demanda;
- o arquivo sai do navegador para o servidor do app e depois para o provider configurado;
- dados extraidos sao preliminares;
- revisao humana continua obrigatoria;
- custo zero nao elimina obrigacao de ler termos, retencao e politicas do provider.

## Guard Rails

No modo `free-cloud`, o router deve bloquear:

- OpenAI;
- modelos pagos do OpenRouter;
- fallback pago automatico;
- IA local/Ollama/LM Studio;
- chamadas externas em testes unitarios;
- qualquer resposta que tente criar preco, SINAPI, H/H, consumo, perda, BDI ou aprovacao.

OpenAI em standby deve continuar bloqueado ate uma decisao explicita habilitar modo pago.

## Testes Esperados Nos Proximos PRs

- `AI_MODE=free-cloud` nao chama OpenAI.
- `AI_PAID_FALLBACK_ENABLED=false` bloqueia fallback pago.
- Provider sem chave retorna fallback manual seguro.
- Provider gratuito com limite/erro retorna pendencia, nao aplica dados.
- Cache hit nao consome quota.
- Testes unitarios usam mocks e nao chamam APIs externas.

## Rollout

1. Documentar politica e envs.
2. Criar router free-cloud com bloqueio contra provider pago.
3. Implementar Gemini Free para analise visual principal.
4. Implementar OpenRouter Free para segunda leitura/comparacao.
5. Implementar providers textuais gratuitos.
6. Mostrar modo/status/fallback manual na UI.
7. Medir precisao com fixtures sanitizadas.

## Fora Do Escopo

- Remover OpenAI.
- Usar IA local.
- Chamar provider pago automaticamente.
- Alterar orcamento, SINAPI, 3D, export, Slack ou GitHub Actions.
- Transformar resultado de IA em orcamento final.
