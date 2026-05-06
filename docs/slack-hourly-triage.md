# Slack Hourly GitHub Triage

## Objetivo

Rodar uma análise horária dos issues e PRs abertos do repositório e enviar um resumo para Slack.

O workflow é informativo. Ele não marca PR como ready, não faz merge, não fecha issue e não usa `Closes #`.

## Como Funciona

Workflow:

```txt
.github/workflows/hourly-slack-triage.yml
```

Script:

```txt
scripts/hourly-github-triage.mjs
```

Frequência:

```txt
7 * * * *
```

O workflow também pode ser acionado manualmente por `workflow_dispatch`.

## Configuração

Criar um Incoming Webhook no Slack para o canal escolhido e salvar a URL como secret do repositório no GitHub:

```txt
Settings -> Secrets and variables -> Actions -> New repository secret
Name: SLACK_TRIAGE_WEBHOOK_URL
Value: https://hooks.slack.com/services/...
```

Não configurar como `NEXT_PUBLIC_*`.

Não colocar a URL em `.env.local`, Vercel ou código versionado.

## Conteúdo Do Relatório

O relatório inclui:

- quantidade de issues abertas;
- quantidade de PRs abertos;
- PRs bloqueados ou não aprovados por `Lucas Review`;
- PRs aprovados para merge manual;
- checks falhando;
- uso proibido de `Closes #`, `Fixes #` ou `Resolves #`;
- issues agrupadas por categoria;
- issues cobertas por PR aberto via `Refs #...`;
- issues sem PR aberto mapeado.

## Comportamento Seguro

O workflow usa `GITHUB_TOKEN` com permissões somente de leitura:

- `contents: read`;
- `issues: read`;
- `pull-requests: read`;
- `checks: read`;
- `statuses: read`.

Se `SLACK_TRIAGE_WEBHOOK_URL` estiver ausente, o workflow falha com mensagem segura.

## Teste Local

Com `GH_TOKEN` configurado localmente:

```bash
DRY_RUN=true GH_TOKEN=... npm run triage:slack
```

O modo `DRY_RUN=true` imprime o relatório no terminal e não envia mensagem para Slack.
