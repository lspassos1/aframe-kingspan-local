# Mapa De IA, Takeoff E Orçamento

## Objetivo

Definir o mapa técnico para transformar planta baixa ou entrada manual em quantitativos revisáveis, vínculos com fonte de preço e orçamento preliminar. Este documento orienta os PRs 5 a 9 da épica [#122](https://github.com/lspassos1/aframe-kingspan-local/issues/122).

## Contrato De IA

Providers oficiais:

- Modo free-cloud: Gemini como análise principal, OpenRouter como segunda leitura e Groq/Cerebras/SambaNova para texto.
- Modo pago explícito: OpenAI com `AI_OPENAI_MODEL=gpt-4o-mini`.
- `AI_OPENAI_MODEL_PREMIUM=gpt-5.4-mini` fica reservado para comparação futura e não é chamado automaticamente.
- Todas as chaves ficam somente no servidor.
- Nenhum `NEXT_PUBLIC_*_API_KEY`.
- Nenhuma chave em log, resposta de API ou código hardcoded.

A IA pode:

- ler PDF/imagem quando o modelo configurado suportar visão/documento;
- extrair dados visíveis;
- calcular ou sugerir dados derivados somente quando a fonte estiver clara;
- listar dúvidas e pendências;
- sugerir vínculos entre quantitativos e composições existentes;
- explicar incertezas.

A IA nunca pode:

- inventar medidas, escala, preço, H/H, consumo, perda ou BDI;
- criar composição SINAPI;
- aprovar orçamento;
- aplicar método automaticamente quando incerto;
- substituir revisão humana;
- dimensionar fundação, estrutura, elétrica ou hidráulica final.

## Schema Alvo

O schema atual deve evoluir de uma extração simples para um resultado estruturado por domínio.

```ts
type PlanAnalysisResult = {
  document: PlanDocumentInfo;
  extractionStatus: "complete" | "partial" | "insufficient";
  scale: ScaleExtraction;
  location: LocationExtraction;
  building: BuildingExtraction;
  rooms: RoomExtraction[];
  walls: WallExtraction;
  openings: OpeningExtraction;
  floors: FloorFinishExtraction;
  roof: RoofExtraction;
  foundation: FoundationExtraction;
  electrical: ElectricalExtraction;
  plumbing: PlumbingExtraction;
  exterior: ExteriorExtraction;
  quantitySeeds: QuantitySeed[];
  assumptions: Assumption[];
  questions: ClarificationQuestion[];
  warnings: ExtractionWarning[];
};
```

Todo valor extraído deve seguir o padrão:

```ts
type ExtractedValue<T> = {
  value: T;
  unit?: string;
  confidence: "high" | "medium" | "low" | "unknown";
  evidence?: string;
  source: "visible" | "calculated" | "estimated_rule" | "user_confirmed" | "manual";
  requiresReview: boolean;
};
```

`QuantitySeed` deve representar a ponte entre leitura da planta e orçamento:

```ts
type QuantitySeed = {
  id: string;
  category:
    | "foundation"
    | "walls"
    | "openings"
    | "flooring"
    | "finishes"
    | "roof"
    | "electrical"
    | "plumbing"
    | "structure"
    | "external"
    | "labor";
  description: string;
  quantity: number;
  unit: "m" | "m2" | "m3" | "un" | "kg" | "h";
  source: "ai_visible" | "system_calculated" | "rule_estimated" | "user_confirmed" | "manual";
  confidence: "high" | "medium" | "low";
  requiresReview: boolean;
  notes: string;
};
```

## Mapa De Dados Da Planta

Documento:

- tipo, páginas, título, revisão, escala, unidade, pavimento, legenda e observações;
- se escala ou unidade faltar, gerar pergunta.

Localização:

- cidade, estado, endereço, bairro, CEP e país quando visíveis;
- cidade/UF são obrigatórias para fonte regional/SINAPI.

Terreno e edificação:

- lote, implantação, recuos, largura, profundidade, área, pavimentos, pé-direito e perímetro;
- não inventar lote se a prancha mostrar apenas a casa.

Ambientes:

- nome, tipo, área escrita/calculada, largura, comprimento, pavimento, seco/molhado e acabamentos visíveis;
- ambiente ilegível vira dúvida, não dado confirmado.

Paredes:

- perímetro, paredes externas/internas/hidráulicas, espessura visível e aberturas;
- sistema calcula área bruta e líquida.

Portas e janelas:

- quantidade, posição, ambiente, tipo, largura, altura e evidência quando visíveis;
- medidas padrão são estimativas revisáveis.

Pisos, revestimentos, pintura e forro:

- áreas por ambiente, áreas molhadas/secas/externas e indicação de acabamento;
- acabamento não pode ser assumido sem premissa ou usuário.

Fundação, cobertura e estrutura:

- apenas dados visíveis ou estimativas preliminares revisáveis;
- fundação e estrutura sempre exigem revisão técnica.

Elétrica e hidráulica:

- coletar pontos visíveis quando houver projeto;
- se não houver projeto, estimar por regras editáveis e marcar como `estimado por média` com revisão obrigatória.

## Regras Determinísticas Iniciais

Paredes:

```txt
area_bruta_parede = comprimento_parede x pe_direito
area_liquida_parede = area_bruta_parede - area_portas - area_janelas
```

Cobertura quando não houver planta:

```txt
area_cobertura = area_projecao x fator_inclinacao x fator_beiral
```

Elétrica por média:

- quarto: 1 ponto de luz, 1 interruptor, 4 tomadas;
- banheiro: 1 ponto de luz, 1 interruptor, 1 tomada, 1 chuveiro;
- cozinha: 1 ponto de luz, 1 interruptor, 8 tomadas, 2 circuitos dedicados;
- sala: 2 pontos de luz, 2 interruptores, 6 tomadas;
- lavanderia: 1 ponto de luz, 1 interruptor, 3 tomadas, 1 ponto de máquina.

Hidráulica por média:

- banheiro: vaso, lavatório, chuveiro, ralo, 3 pontos de água fria, 3 pontos de esgoto;
- cozinha: pia, 1 ponto de água fria, 1 ponto de esgoto;
- lavanderia: tanque, máquina, 2 pontos de água fria, 2 pontos de esgoto.

Tudo que vier dessas regras deve aparecer como estimativa revisável.

## Pipeline De Orçamento

```txt
PlanAnalysisResult / ManualInput
-> QuantitySeed[]
-> BudgetQuantity[]
-> searchSinapiCompositions()
-> suggestSinapiQuantityMatches()
-> OpenAI opcional reordena IDs existentes
-> usuário aprova
-> BudgetServiceLine[]
-> orçamento preliminar
-> exportação
```

Bloqueios:

- quantidade sem revisão não entra como orçamento revisado;
- preço sem fonte fica pendente;
- preço `zeroed`, `missing`, `invalid_unit` ou `out_of_region` fica pendente;
- ID inexistente retornado por IA é rejeitado;
- unidade incompatível bloqueia aprovação automática;
- método incerto mantém pendência.

## UI De Revisão

A revisão deve ser organizada por blocos:

- Documento e escala;
- Localização;
- Lote e implantação;
- Área e dimensões;
- Ambientes;
- Paredes;
- Portas e janelas;
- Fundação e cobertura;
- Elétrica e hidráulica;
- Dúvidas;
- Quantitativos.

Cada bloco deve permitir:

- ver valor atual e valor extraído;
- ver confiança e evidência;
- editar antes de aplicar;
- selecionar campos;
- deixar baixa confiança desmarcada por padrão;
- descartar extração;
- voltar para manual.

## Manual Input

O preenchimento manual deve produzir o mesmo tipo de dado que a extração:

- ambientes;
- paredes;
- portas;
- janelas;
- pisos;
- revestimentos;
- fundação preliminar;
- cobertura preliminar;
- elétrica estimada;
- hidráulica estimada;
- método;
- base de preço.

O 3D deve refletir, quando possível:

- largura;
- profundidade;
- pavimentos;
- cobertura;
- volume;
- terreno;
- recuos;
- método;
- aberturas simplificadas.

## Integração Com A Base Atual

Reutilizar:

- `BudgetQuantity`;
- `ServiceComposition`;
- `BudgetMatch`;
- `BudgetServiceLine`;
- `searchSinapiCompositions`;
- `suggestSinapiQuantityMatches`;
- importação SINAPI controlada;
- exportações existentes;
- motores de método construtivo e A-frame.

Adicionar somente os metadados necessários para análise de planta, `QuantitySeed`, perguntas, evidências e revisão.

## Testes Esperados

- schema aceita dados completos e parciais;
- JSON inválido é rejeitado;
- planta sem escala gera pergunta;
- planta sem cidade/UF gera pergunta;
- método incerto não aplica automaticamente;
- baixa confiança fica desmarcada;
- elétrica/hidráulica por média exige revisão;
- fundação/cobertura estimadas exigem revisão;
- portas, janelas e ambientes manuais geram seeds;
- paredes, piso, cobertura e fundação geram quantitativos determinísticos;
- `QuantitySeed` vira `BudgetQuantity`;
- matching SINAPI rejeita ID inexistente, unidade incompatível e preço pendente;
- exportação mantém fonte, status e revisão.
