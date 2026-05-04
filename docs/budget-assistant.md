# Budget Assistant

Este documento define o contrato tecnico do Budget Assistant. O objetivo e transformar quantitativos preliminares em um orcamento revisavel, sem inventar preco e sem chamar estimativa preliminar de orcamento final.

O fluxo nao substitui orcamentista, projeto estrutural, projeto arquitetonico, ART/RRT, aprovacao municipal, sondagem, cotacao formal ou validacao tecnica de fornecedor.

## Fluxo

1. O metodo construtivo gera quantitativos preliminares.
2. O usuario cadastra ou importa fontes de preco com data-base, unidade, cidade/UF e confianca.
3. O sistema sugere matches entre quantitativos e itens de preco existentes.
4. O usuario aprova, rejeita ou deixa cada match pendente.
5. Apenas matches aprovados e sem pendencias podem entrar em orcamento revisado.
6. BDI, contingencia e perdas devem aparecer separados do custo direto.

## Dados minimos

Fonte de preco:

- tipo: SINAPI, TCPO, cotacao de fornecedor, manual, historico ou referencia web;
- titulo e fornecedor;
- cidade e UF, ou base nacional quando aplicavel;
- data de referencia;
- confianca;
- observacoes e arquivo/origem quando existir.

Item de preco:

- metodo construtivo;
- categoria;
- descricao;
- quantidade e unidade;
- preco unitario e total;
- `sourceId` e `sourceCode`;
- confianca;
- flag de revisao.

Match:

- quantitativo;
- item de preco existente;
- motivo;
- compatibilidade de unidade;
- confianca;
- aprovacao humana.

## Regras de seguranca

- Preco sem fonte cadastrada nao pode entrar em orcamento revisado.
- Match sem aprovacao humana permanece pendente.
- Match com unidade incompativel permanece revisavel.
- Item de baixa confianca ou sem verificacao deve aparecer como pendencia.
- A IA pode sugerir match, mas nao cria preco e nao aprova item automaticamente.
- Busca web, quando existir, e referencia fraca e nunca verdade final automatica.

## Cidade, UF e fallback

A selecao de fonte deve seguir prioridade regional:

1. cidade do cenario;
2. UF do cenario;
3. base nacional;
4. fallback manual revisavel.

Quando cidade ou UF do cenario estiverem ausentes, o Budget Assistant deve bloquear a entrada em fluxo assistido e pedir preenchimento da localizacao.

## Composicoes tecnicas

Composicoes devem separar:

- material;
- mao de obra;
- equipamento;
- terceiros;
- outros custos.

Quando houver H/H, consumo, perdas, BDI e contingencia:

- H/H fica associado a funcao de mao de obra e data-base da fonte;
- perdas ficam explicitas por regra ou composicao;
- BDI e contingencia nao entram no custo direto;
- total revisado so existe apos aprovacao humana.

## IA, cache e rate limit

A extracao de planta e o matching assistido devem respeitar os mesmos principios:

- validar JSON antes de aplicar dados;
- manter limite diario por usuario/IP/global;
- usar cache por hash do arquivo/modelo quando aplicavel;
- nao consumir quota quando houver cache hit valido;
- invalidar cache por versao quando prompt, schema ou provider mudarem;
- nunca registrar conteudo bruto de planta ou cotacao em logs.

## Validacao automatizada

O contrato minimo esta coberto por testes que validam:

- rate limit e cache da IA;
- rejeicao de cache invalido;
- JSON de extracao validado por schema;
- fonte manual com data, unidade e confianca;
- sugestao de match sempre pendente;
- bloqueio de orcamento revisado quando houver preco sem fonte ou match sem revisao.
