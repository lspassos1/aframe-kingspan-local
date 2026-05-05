# Assistente de orçamento

Este documento define o contrato técnico do Assistente de orçamento. O objetivo é transformar quantitativos preliminares em um orçamento revisável, sem inventar preço e sem chamar estimativa preliminar de orçamento final.

O fluxo não substitui orçamentista, projeto estrutural, projeto arquitetônico, ART/RRT, aprovação municipal, sondagem, cotação formal ou validação técnica de fornecedor.

## Fluxo

1. O método construtivo gera quantitativos preliminares.
2. O usuário cadastra ou importa fontes de preço com data-base, unidade, cidade/UF e confiança.
3. O sistema sugere matches entre quantitativos e itens de preço existentes.
4. O usuário aprova, rejeita ou deixa cada match pendente.
5. Apenas matches aprovados e sem pendências podem entrar em orçamento revisado.
6. BDI, contingência e perdas devem aparecer separados do custo direto.

## Dados mínimos

Fonte de preço:

- tipo: SINAPI, TCPO, cotação de fornecedor, manual, histórico ou referência web;
- título e fornecedor;
- cidade e UF, ou base nacional quando aplicável;
- data de referência;
- confiança;
- observações e arquivo/origem quando existir.

Item de preço:

- método construtivo;
- categoria;
- descrição;
- quantidade e unidade;
- preço unitário e total;
- `sourceId` e `sourceCode`;
- confiança;
- flag de revisão.

Match:

- quantitativo;
- item de preço existente;
- motivo;
- compatibilidade de unidade;
- confiança;
- aprovação humana.

## Regras de segurança

- Preço sem fonte cadastrada não pode entrar em orçamento revisado.
- Match sem aprovação humana permanece pendente.
- Match com unidade incompatível permanece revisável.
- Item de baixa confiança ou sem verificação deve aparecer como pendência.
- A IA pode sugerir match, mas não cria preço e não aprova item automaticamente.
- Busca web, quando existir, é referência fraca e nunca verdade final automática.

## Cidade, UF e fallback

A seleção de fonte deve seguir prioridade regional:

1. cidade do cenário;
2. UF do cenário;
3. base nacional;
4. fallback manual revisável.

Quando cidade ou UF do cenário estiverem ausentes, o Assistente de orçamento deve bloquear a entrada em fluxo assistido e pedir preenchimento da localização.

## Composições técnicas

Composições devem separar:

- material;
- mão de obra;
- equipamento;
- terceiros;
- outros custos.

Quando houver H/H, consumo, perdas, BDI e contingência:

- H/H fica associado à função de mão de obra e data-base da fonte;
- perdas ficam explícitas por regra ou composição;
- BDI e contingência não entram no custo direto;
- total revisado só existe após aprovação humana.

## IA, cache e rate limit

A extração de planta e o matching assistido devem respeitar os mesmos princípios:

- validar JSON antes de aplicar dados;
- manter limite diário por usuário/IP/global;
- usar cache por hash do arquivo/modelo quando aplicável;
- não consumir quota quando houver cache hit válido;
- invalidar cache por versao quando prompt, schema ou provider mudarem;
- nunca registrar conteúdo bruto de planta ou cotação em logs.

## Validação automatizada

O contrato mínimo está coberto por testes que validam:

- rate limit e cache da IA;
- rejeição de cache inválido;
- JSON de extração validado por schema;
- fonte manual com data, unidade e confiança;
- sugestão de match sempre pendente;
- bloqueio de orçamento revisado quando houver preço sem fonte ou match sem revisão.
