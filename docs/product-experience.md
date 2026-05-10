# Experiência Alvo Do Produto

O produto deve parecer uma experiência moderna de pré-orçamento assistido, não um sistema técnico interno centrado em um único método.

## Posição

Estudo Construtivo ajuda o usuário a sair de uma planta baixa ou medidas simples e chegar a um orçamento preliminar revisável com fonte de preço.

Fluxo principal:

```txt
planta/medidas -> revisão -> método -> quantitativos -> base de preços -> orçamento -> exportação
```

## Regra Central

O produto não começa pelo método construtivo.

A primeira decisão do usuário deve ser:

1. enviar planta baixa;
2. preencher manualmente;
3. usar exemplo.

O método construtivo vem depois, como etapa guiada ou sugestão revisável. Se a IA sugerir método, ele deve aparecer como sugestão com confiança e nunca como troca automática quando houver incerteza.

## A-frame Como Baseline

A-frame continua funcionando como baseline de regressão técnica:

- criação de estudo A-frame;
- modelo 3D A-frame;
- cálculo de geometria;
- materiais e painéis;
- estrutura A-frame;
- orçamento preliminar existente;
- exportações existentes;
- rotas protegidas por método;
- testes existentes relacionados ao A-frame.

Isso não significa que a experiência final deve continuar centrada em A-frame.

## IA Assistiva

A IA atua como pré-preenchimento e explicação de incertezas. O runtime atual usa OpenAI API quando habilitado; o ciclo free-cloud define OpenAI em standby e providers gratuitos por tarefa para PRs futuros.

A IA pode:

- ler planta baixa em PDF/imagem quando o modelo configurado suportar visão/documento;
- extrair campos preliminares da planta;
- sugerir vínculos entre quantitativos e composições existentes;
- explicar pendências.

A IA nunca pode:

- inventar preço;
- criar composição SINAPI;
- inventar H/H, consumo, perda ou BDI;
- aprovar orçamento;
- substituir revisão humana;
- aplicar método construtivo incerto automaticamente.

## Orçamento Determinístico

O orçamento é calculado pelo sistema a partir de dados revisados, quantitativos e fontes de preço importadas ou cadastradas. A IA não calcula preço final e não aprova item.

Todo item deve carregar:

- fonte;
- código quando existir;
- UF/cidade ou base nacional;
- data-base;
- unidade;
- confiança;
- status de revisão.

Relatórios devem usar linguagem de orçamento preliminar/revisável, nunca orçamento final.

## SINAPI Controlado

Não existe crawler SINAPI nesta entrega. O usuário importa arquivo oficial, ZIP oficial, CSV/XLSX/JSON ou base normalizada equivalente.

Preço `0`, vazio ou ausente não entra como preço válido. Esses casos devem aparecer como pendência para revisão humana.
