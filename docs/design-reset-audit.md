# Auditoria Visual - Design Reset e Takeoff Assistido por IA

## Contexto

Esta auditoria inicia a épica [#122](https://github.com/lspassos1/aframe-kingspan-local/issues/122) e referencia a issue [#123](https://github.com/lspassos1/aframe-kingspan-local/issues/123).

O objetivo é registrar o estado visual atual antes do redesenho profundo. Este PR não implementa UI; ele documenta o que existe, o que está bloqueando a percepção de produto moderno e como os próximos PRs devem evoluir a experiência.

Fonte de escopo: prompt anexado/conteúdo da conversa, sem depender de caminho local em `Downloads`.

## Pré-requisito Vercel

`ADMIN_EMAILS` foi verificado antes da auditoria:

- Production: variável existe, valor legível via `vercel env pull`, contém `lucaspfl@gmail.com`.
- Preview: variável existe, valor legível e igual ao Production.
- Development: não foi alterado.
- Outros env vars: não foram alterados.
- Separador usado: valor único, sem vírgula ou quebra de linha.
- Redeploy: não é necessário porque não houve alteração de env.

`/admin/feedback` não foi capturada nesta auditoria porque a sessão local não estava autenticada/autorizada como admin via Clerk. Não houve simulação, bypass ou alteração de regra de autorização.

## Validação Visual Executada

Ambiente:

- Dev server local: `http://localhost:3000`
- Desktop: `1440x1000`
- Mobile: `390x844`
- Ferramentas: Browser inicializado e Playwright para screenshots versionados.
- Pasta: `docs/design-audit/screenshots/`
- Peso total dos PNGs: aproximadamente 5.8 MB.

Observação importante: as rotas protegidas por Clerk redirecionaram para `/` sem sessão autenticada. Os screenshots dessas rotas registram o estado bloqueado. Isso é um achado da auditoria, não validação visual autenticada das telas internas.

## Inventário De Screenshots

| Rota | Desktop | Mobile | Resultado |
| --- | --- | --- | --- |
| `/` | `home-desktop.png` | `home-mobile.png` | Capturada |
| `/start` | `start-desktop.png` | `start-mobile.png` | Redirecionou para `/` sem auth |
| `/dashboard` | `dashboard-desktop.png` | `dashboard-mobile.png` | Redirecionou para `/` sem auth |
| `/edit` | `edit-desktop.png` | `edit-mobile.png` | Redirecionou para `/` sem auth |
| `/budget` | `budget-desktop.png` | `budget-mobile.png` | Redirecionou para `/` sem auth |
| `/budget-assistant` | `budget-assistant-desktop.png` | `budget-assistant-mobile.png` | Redirecionou para `/` sem auth |
| `/model-3d` | `model-3d-desktop.png` | `model-3d-mobile.png` | Redirecionou para `/` sem auth |
| `/materials` | `materials-desktop.png` | `materials-mobile.png` | Redirecionou para `/` sem auth |
| `/technical-project` | `technical-project-desktop.png` | `technical-project-mobile.png` | Redirecionou para `/` sem auth |
| `/structure` | `structure-desktop.png` | `structure-mobile.png` | Redirecionou para `/` sem auth |
| `/settings` | `settings-desktop.png` | `settings-mobile.png` | Redirecionou para `/` sem auth |
| `/quotation` | `quotation-desktop.png` | `quotation-mobile.png` | Redirecionou para `/` sem auth |
| `/scenarios` | `scenarios-desktop.png` | `scenarios-mobile.png` | Redirecionou para `/` sem auth |
| `/export` | `export-desktop.png` | `export-mobile.png` | Redirecionou para `/` sem auth |
| `/help` | `help-desktop.png` | `help-mobile.png` | Redirecionou para `/` sem auth |
| `/feedback` | `feedback-desktop.png` | `feedback-mobile.png` | Capturada |
| `/admin/feedback` | não capturada | não capturada | Sessão não autorizada como admin |

## Achados Críticos

1. `/start` está protegido pelo middleware, mas a experiência planejada depende de começar por `/start`. Um usuário sem sessão não vê as três opções de entrada; é redirecionado para a Home.
2. A auditoria autenticada das rotas internas ficou bloqueada por falta de sessão Clerk. Para os próximos PRs de UI, a validação deve ocorrer em sessão real autenticada ou registrar bloqueio.
3. A Home comunica melhor a proposta de planta -> revisão -> orçamento, mas ainda carrega sensação de página pública genérica em vez de colocar a ação de upload como primeira interação concreta.
4. O app ainda depende de telas internas densas e especializadas, segundo inspeção de código das páginas. `/edit` concentra dados de projeto, terreno, painel, A-frame e preço no mesmo fluxo.
5. O orçamento atual ainda é fragmentado por método e por tabelas. A tela precisa virar uma superfície de decisão com total preliminar, pendências, fonte ativa, data-base e revisão humana.
6. O schema atual de IA é estreito: cobre projeto, localização, método, dimensões básicas e contagem de portas/janelas, mas não cobre documento, escala, ambientes, paredes, aberturas detalhadas, elétrica, hidráulica, fundação, cobertura, perguntas e `QuantitySeed`.
7. O fluxo manual ainda não tem modelo de ambientes, portas e janelas como objetos editáveis. Sem isso, o takeoff manual não consegue alimentar quantitativos ricos.
8. A navegação foi simplificada anteriormente, mas a experiência ainda começa pesada depois do login porque o produto não tem um shell visual de etapas do estudo.

## O Que Está Ruim Visualmente

- Primeira camada ainda tem texto explicativo demais para uma tarefa operacional.
- A ação "Enviar planta" não parece ser o centro absoluto da experiência.
- Cards e tabelas aparecem como superfícies administrativas, não como etapas de decisão.
- O app mistura premissas técnicas, método construtivo, orçamento e configurações cedo demais.
- Telas como `/edit`, `/budget` e `/budget-assistant` tendem a crescer como formulários ou planilhas.
- Falta resumo fixo de pendências e progresso.
- Falta vocabulário visual consistente para confiança, evidência, fonte, revisão e pendência.
- Faltam editores dedicados para ambientes, portas e janelas.

## Direção Visual Recomendada

- Fundo claro, contraste limpo e menos peso visual escuro.
- Headings curtos, sem paredes de texto.
- Fluxo por etapas com um resumo lateral/sticky quando houver decisão.
- Upload de planta como card/área primária, com dropzone e estado operacional claro.
- Técnica sob demanda em disclosures, drawers ou painéis avançados.
- Cards de revisão com antes/depois, evidência, confiança e seleção.
- Orçamento como superfície de aprovação, não como tabela bruta.
- 3D grande e útil, com painel lateral recolhível e ações de edição/orçamento/exportação.

## Componentes Necessários

Base visual:

- `PageFrame`
- `PageHeader`
- `SectionHeader`
- `StepShell`
- `StepProgress`
- `ActionCard`
- `MetricCard`
- `StatusPill`
- `StickySummary`
- `AdvancedDisclosure`
- `InlineHelp`
- `FormSection`

Revisão e IA:

- `ReviewCard`
- `EvidenceCard`
- `QuestionCard`
- `FileDropzone`
- `ConfidenceBadge`
- `PendingState`
- `EmptyState`

Orçamento e fonte:

- `SourceBadge`
- `QuantityCard`
- `BudgetGroupCard`

Entrada manual:

- `NumericAdjuster`
- `OpeningEditor`
- `RoomEditor`

Regra: não criar componente genérico sem uso real no PR em que ele nasce.

## Dados Que A IA Pode Coletar

A IA pode coletar apenas dados visíveis, calculáveis a partir do visível ou estimáveis por regra com aceitação/revisão do usuário:

- documento, tipo de desenho, páginas, título, revisão, escala, unidade e observações;
- cidade, estado, endereço, bairro, CEP e país quando visíveis;
- lote, implantação, recuos, área externa e garagem externa quando visíveis;
- área construída, área útil, pavimentos, perímetro, pé-direito quando visível;
- ambientes, áreas, largura, comprimento, pavimento, tipo seco/molhado e acabamentos visíveis;
- paredes, espessuras visíveis, perímetros, aberturas e comprimentos;
- portas e janelas com tipo, dimensão, ambiente e evidência quando visíveis;
- pisos, revestimentos, pintura, forro, fundação preliminar, cobertura preliminar;
- estrutura visível, pontos elétricos visíveis, pontos hidráulicos visíveis, louças/metais e áreas externas;
- dúvidas, incertezas, alertas, premissas e `QuantitySeed[]`.

Cada valor deve carregar fonte, unidade quando houver, confiança, evidência, revisão obrigatória e pendência quando necessário.

## Dados Que A IA Não Pode Inventar

A IA não pode:

- inventar medida, escala, preço, H/H, consumo, perda ou BDI;
- criar composição SINAPI;
- aprovar orçamento;
- aplicar dados sem revisão;
- dimensionar fundação ou estrutura;
- criar projeto elétrico ou hidráulico;
- substituir arquiteto, engenheiro, sondagem, ART/RRT ou aprovação municipal;
- chamar orçamento de final;
- esconder incerteza ou transformar estimativa em dado confirmado.

## Perguntas Que A IA Deve Fazer

Quando faltar dado, a interface deve coletar perguntas antes de gerar orçamento. Exemplos:

- Qual medida real posso usar como referência?
- Qual é a cidade e o estado da obra?
- Qual pé-direito deseja considerar?
- Qual método construtivo deseja usar?
- A planta mostra o lote inteiro ou apenas a casa?
- Deseja estimar fundação como radier preliminar ou baldrame preliminar?
- Existe planta de cobertura?
- Qual tipo de telhado deseja considerar?
- Deseja usar acabamento econômico, médio ou superior?
- A planta possui projeto elétrico?
- Posso estimar pontos elétricos por média de ambiente?
- A planta possui projeto hidráulico?
- Posso estimar pontos hidráulicos por áreas molhadas?
- Deseja usar base SINAPI da UF ou base importada?

## Como O Takeoff Vira Orçamento

Pipeline alvo:

```txt
PlanAnalysisResult / ManualInput
-> QuantitySeed[]
-> BudgetQuantity[]
-> busca determinística em SINAPI/base importada
-> matching determinístico
-> IA opcional apenas reordena candidatos existentes
-> usuário aprova
-> BudgetServiceLine[]
-> orçamento preliminar
-> exportação
```

Regras:

- orçamento depende de quantidade revisada;
- orçamento depende de fonte;
- preço sem fonte fica pendente;
- SINAPI `zeroed` fica pendente;
- unidade incompatível fica pendente;
- elétrica/hidráulica por média fica pendente até confirmação do usuário;
- fundação e estrutura ficam com alerta técnico;
- relatório nunca chama orçamento de final.

## Próximos PRs

1. Design System Base.
2. Home Nova.
3. Start Novo.
4. Schema Avançado De Planta.
5. UI De Revisão Da Planta.
6. Motor De Quantitativos.
7. Preenchimento Manual Novo.
8. Orçamento A Partir Dos Quantity Seeds.
9. Redesign Das Telas Internas.
10. Auditoria Visual Final.

Todos devem permanecer abertos para revisão humana.
