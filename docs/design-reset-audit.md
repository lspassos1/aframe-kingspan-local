# Auditoria Visual - Design Reset e Takeoff Assistido por IA

## Contexto

Esta auditoria inicia a épica [#122](https://github.com/lspassos1/aframe-kingspan-local/issues/122) e referencia a issue [#123](https://github.com/lspassos1/aframe-kingspan-local/issues/123).

O objetivo é registrar o estado visual atual antes do redesenho profundo. Este PR não implementa UI; ele documenta o que existe, o que ainda parece sistema técnico interno e como os próximos PRs devem evoluir a experiência.

Fonte de escopo: prompt anexado/conteúdo da conversa, sem depender de caminho local em `Downloads`.

## Pré-requisito Vercel

`ADMIN_EMAILS` foi verificado antes da auditoria:

- Production: variável existe, valor legível via `vercel env pull`, contém `lucaspfl@gmail.com`.
- Preview: variável existe, valor legível e igual ao Production.
- Development: não foi alterado.
- Outros env vars: não foram alterados.
- Separador usado: valor único, sem vírgula ou quebra de linha.
- Redeploy: não é necessário porque não houve alteração de env.

Depois do login real do Lucas no app em produção, `https://aframe-kingspan-local.vercel.app/api/admin/status` retornou `{"isAdmin":true}` na sessão autenticada. O acesso admin está autorizado por `ADMIN_EMAILS` em Production.

## Validação Visual Executada

Ambiente:

- Produção autenticada no in-app browser: `https://aframe-kingspan-local.vercel.app/start`.
- Dev server local autenticado via Clerk: `http://localhost:3000`.
- Desktop: `1440x1000`.
- Mobile: `390x844`.
- Ferramentas: Browser para validar sessão real do usuário e Playwright para screenshots versionados.
- Pasta: `docs/design-audit/screenshots/`.
- Peso total dos PNGs: aproximadamente 3.3 MB.

Fluxo usado:

1. Lucas fez login real no in-app browser em produção.
2. A sessão de produção confirmou acesso a `/start` e status admin verdadeiro.
3. O preview da Vercel do PR estava `Ready`, mas o acesso HTTP direto permanecia protegido por SSO/401.
4. Para screenshots desktop/mobile consistentes, foi usado o dev server local com sessão Clerk autenticada e o exemplo carregado por `/start?mode=example`.
5. As rotas internas foram abertas pelo shell autenticado, não por screenshots de redirect.

Achado técnico de navegação: a abertura direta de rotas internas em um novo carregamento pode redirecionar para `/start` antes da hidratação do project store local. Para capturar o app real, as rotas internas foram acessadas pelo shell autenticado depois de carregar o exemplo. Isso deve ser tratado nos PRs de shell/onboarding, sem remover a proteção de rotas.

`/admin/feedback` foi capturada. A autorização admin foi confirmada em Production, mas a tela local exibiu erro operacional ao carregar a lista de melhorias porque `/api/admin/feedback` retornou `502`. Isso afeta dados da tabela, não a autorização visual da rota.

## Inventário De Screenshots

| Rota | Desktop | Mobile | Resultado |
| --- | --- | --- | --- |
| `/` | `home-desktop.png` | `home-mobile.png` | Capturada autenticada |
| `/start` | `start-desktop.png` | `start-mobile.png` | Capturada autenticada |
| `/dashboard` | `dashboard-desktop.png` | `dashboard-mobile.png` | Capturada com projeto exemplo |
| `/edit` | `edit-desktop.png` | `edit-mobile.png` | Capturada com projeto exemplo |
| `/budget` | `budget-desktop.png` | `budget-mobile.png` | Capturada com projeto exemplo |
| `/budget-assistant` | `budget-assistant-desktop.png` | `budget-assistant-mobile.png` | Capturada com projeto exemplo |
| `/model-3d` | `model-3d-desktop.png` | `model-3d-mobile.png` | Capturada com projeto exemplo |
| `/materials` | `materials-desktop.png` | `materials-mobile.png` | Capturada com projeto exemplo |
| `/technical-project` | `technical-project-desktop.png` | `technical-project-mobile.png` | Capturada com projeto exemplo |
| `/structure` | `structure-desktop.png` | `structure-mobile.png` | Capturada com projeto exemplo |
| `/settings` | `settings-desktop.png` | `settings-mobile.png` | Capturada com projeto exemplo |
| `/quotation` | `quotation-desktop.png` | `quotation-mobile.png` | Capturada com projeto exemplo |
| `/scenarios` | `scenarios-desktop.png` | `scenarios-mobile.png` | Capturada com projeto exemplo |
| `/export` | `export-desktop.png` | `export-mobile.png` | Capturada com projeto exemplo |
| `/help` | `help-desktop.png` | `help-mobile.png` | Capturada com projeto exemplo |
| `/feedback` | `feedback-desktop.png` | `feedback-mobile.png` | Capturada autenticada |
| `/admin/feedback` | `admin-feedback-desktop.png` | `admin-feedback-mobile.png` | Capturada; lista retornou erro 502 |

## Análise Visual Por Rota

### `/`

A Home já comunica planta baixa, revisão, base de preço, orçamento e exportação. Ainda parece uma página explicativa com muito texto antes da ação concreta. O CTA "Começar com planta" é correto, mas a tela não mostra uma interação de upload ou exemplo visual no primeiro viewport.

### `/start`

O início está mais alinhado ao produto: três caminhos claros, método fora da primeira camada e upload como opção primária. O problema é que o upload aparece como "IA desligada" sem uma explicação operacional curta no próprio card. A experiência ainda não mostra uma prévia do que acontecerá depois da escolha.

### `/dashboard`

O painel tem bons números executivos, mas ainda mistura resumo, alertas, projetos salvos e estado técnico em uma página longa. No mobile, o conteúdo vira uma sequência extensa de cartões e o usuário perde a noção de progresso. Precisa de uma hierarquia mais forte: status do estudo, pendências, próximo passo e ação primária.

### `/edit`

É a tela mais crítica visualmente. Ainda parece formulário técnico interno: localização, terreno, método, painel, geometria e preço aparecem juntos. A etapa deveria ser "Dados da obra" com seções guiadas e editores menores, não uma página única de parâmetros.

### `/budget`

O orçamento mostra total preliminar e pendências, mas ainda se comporta como relatório/tabela. Falta transformar cada grupo em decisão: quantidade revisada, fonte, status, confiança e ação de resolver pendência. Os avisos existem, mas competem com tabelas densas.

### `/budget-assistant`

A tela de base de preços concentra importação, fontes, composições, candidatos e vínculos. Está correta tecnicamente, mas pesada para um usuário novo. Deve virar fluxo: importar base, validar UF/referência/regime, buscar composições e aprovar vínculo.

### `/model-3d`

O 3D é uma das melhores provas de valor, mas aparece cercado por muitos controles técnicos. No desktop, o painel de parâmetros domina a percepção. No mobile, a experiência fica apertada e os controles competem com a visualização. Precisa de modo visual mais limpo e painel recolhível.

### `/materials`

A lista de materiais ainda parece uma planilha operacional. É útil para regressão A-frame, mas não deve ser a primeira linguagem visual do produto modular. Precisa agrupar por sistema, pendência e fonte.

### `/technical-project`

A tela tem informação técnica útil, mas reforça a sensação de documento interno. Deve ser reposicionada como área avançada, com desenhos e premissas sob demanda.

### `/structure`

A tela confirma que o baseline A-frame segue funcionando, mas o rótulo "Estrutura A-frameA-frame" aparece duplicado na navegação mobile. Essa duplicação deve ser corrigida no redesign do shell. Conteúdo técnico deve permanecer protegido por método.

### `/settings`

"Premissas" concentra catálogos e parâmetros editáveis. A tela é necessária, mas parece administração de banco interno. Deve virar área avançada com linguagem de "fontes, catálogos e premissas" e menos tabela visível no primeiro viewport.

### `/quotation`

A cotação entrega textos prontos, mas visualmente parece uma página utilitária isolada. Deve se conectar ao estado do orçamento: itens pendentes, fontes ausentes e próximos pedidos.

### `/scenarios`

A comparação de alternativas é valiosa, mas ainda é muito orientada a gráfico/tabela técnica. Precisa destacar decisão: cenário atual, diferença de custo, diferença de área e risco técnico.

### `/export`

A exportação lista JSON, XLSX, CSV e PDF com boa clareza. Ainda falta mostrar status do que será exportado: orçamento preliminar, pendências, data-base, fonte e revisão humana.

### `/help`

O checklist operacional é útil e já explica IA, OpenAI, SINAPI, UF, referência e regime. Visualmente, deve virar uma área de diagnóstico mais direta, com ações para resolver configuração ausente.

### `/feedback`

A tela é funcional, mas tem copy longa sobre privacidade e GitHub antes do formulário. Deve manter segurança, mas com leitura mais leve.

### `/admin/feedback`

A rota admin fica visível para usuário autorizado. Os cards de Pendentes/Aprovadas/Recusadas são claros, mas a tela mostrou erro "Nao foi possivel carregar as melhorias" porque a API retornou `502`. O design deve separar estado de autorização, estado de integração GitHub e estado vazio da tabela.

## Achados Críticos

1. O produto já tem fluxo autenticado funcional, mas as telas internas ainda parecem uma suíte técnica A-frame em vez de estudo construtivo guiado.
2. `/edit`, `/budget-assistant`, `/materials`, `/settings` e `/technical-project` concentram a maior parte da sensação de sistema interno.
3. O shell mobile expõe duplicação de label: `Estrutura A-frameA-frame`.
4. O onboarding em `/start` está no caminho certo, mas ainda depende de "IA desligada" sem diagnóstico acionável no primeiro card.
5. O 3D funciona como baseline de valor, mas precisa de uma apresentação visual mais limpa antes dos controles técnicos.
6. O orçamento ainda não deixa a revisão humana, fonte e pendências fortes o bastante por linha.
7. A rota admin está autorizada, mas a integração de dados de feedback falhou com `502`; isso deve aparecer como pendência operacional.
8. Console local registrou avisos existentes de Recharts em containers com largura/altura `-1` em rotas de orçamento/cenários e avisos de Three.js deprecated no 3D. Não são bloqueios deste PR de auditoria, mas devem entrar como risco de polish/performance.

## O Que Está Ruim Visualmente

- Formulários e tabelas ainda dominam as telas internas.
- Cards técnicos competem com decisões principais.
- Há muita linguagem de parâmetro, catálogo, composição e estrutura cedo demais.
- O app não mantém uma linha visual contínua de planta -> revisão -> quantitativo -> fonte -> orçamento.
- Mobile funciona, mas parece uma versão empilhada do desktop, não um fluxo pensado para decisão.
- Falta uma gramática visual consistente para `pendente`, `revisado`, `fonte`, `confiança`, `evidência` e `ação`.

## Nova Direção Visual

- Primeiro viewport deve mostrar ação e estado, não documentação.
- Cada tela deve ter uma ação primária e um resumo de pendências.
- Detalhe técnico deve ficar em área avançada, disclosure, drawer ou seção secundária.
- O 3D deve aparecer grande e útil, com controles progressivos.
- Orçamento deve ser superfície de aprovação, não apenas tabela.
- Manual e IA devem produzir o mesmo tipo de revisão: perguntas, campos editáveis, evidência, confiança e seeds de quantidade.

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
