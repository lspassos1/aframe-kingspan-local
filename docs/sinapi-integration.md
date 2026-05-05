# Integração SINAPI Controlada

SINAPI entra no produto como base importada e revisável. Não há crawler automático nesta entrega.

## Entradas Aceitas

O usuário pode importar:

- arquivo oficial;
- ZIP oficial;
- CSV;
- XLSX;
- JSON;
- base normalizada equivalente.

O importador deve ler arquivos em memória e persistir dados normalizados no modelo atual do app. Em ambiente serverless/Vercel, não gravar arquivos SINAPI no filesystem runtime.

## Persistência Atual

Enquanto não houver banco externo, persistir no project store e export/import JSON usando:

- `budgetAssistant.priceSources`;
- `budgetAssistant.serviceCompositions`;
- coleções técnicas existentes;
- metadados suficientes para futura migração para Postgres/Supabase/Neon.

## Status De Preço

Status previstos:

- `valid`;
- `zeroed`;
- `missing`;
- `requires_review`;
- `invalid_unit`;
- `out_of_region`;
- `invalid`.

Regras:

- preço `0` vira `zeroed`;
- preço vazio ou ausente vira `missing`;
- UF ausente vira `requires_review`;
- referência ausente vira `requires_review`;
- regime ausente vira `unknown`;
- composição sem unidade válida não entra como revisada;
- fonte fora da UF do projeto vira pendência;
- nada entra como orçamento revisado sem aprovação humana.

## Tipos Mínimos

```ts
type SinapiRegime = "onerado" | "nao_desonerado" | "desonerado" | "unknown";
type SinapiPriceStatus =
  | "valid"
  | "zeroed"
  | "missing"
  | "requires_review"
  | "invalid_unit"
  | "out_of_region"
  | "invalid";
```

Criar:

- `SinapiSource`;
- `SinapiComposition`;
- `SinapiCompositionInput`.

Funções:

- `importSinapiPriceBase`;
- `normalizeSinapiRows`;
- `validateSinapiSource`;
- `searchSinapiCompositions`;
- `mapSinapiCompositionToServiceComposition`.

## Matching

Fluxo esperado:

```txt
quantitativo do projeto
-> busca determinística em composições SINAPI
-> candidatos ordenados
-> IA opcional reordena/escolhe IDs existentes
-> usuário aprova
-> sistema calcula
```

Matching determinístico usa:

- método construtivo;
- categoria;
- unidade;
- UF;
- referência;
- regime;
- tags;
- palavras da descrição;
- compatibilidade de unidade.

IA OpenAI opcional recebe no máximo 10 a 20 candidatos e retorna apenas IDs existentes, confiança, motivo e pendência.

Se a IA retornar ID inexistente, unidade incompatível, preço `zeroed`, fonte fora de UF ou método incerto, o vínculo permanece pendente.

## Exportação

Orçamento e exportações devem incluir:

- código;
- descrição;
- UF;
- referência;
- regime;
- unidade;
- quantidade;
- preço unitário;
- material;
- mão de obra;
- equipamento;
- H/H quando existir;
- status do preço;
- fonte;
- confiança;
- revisão.
