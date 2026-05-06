# Slack GitHub Review Bridge

## Objetivo

Permitir que Lucas/ChatGPT envie revisões pelo Slack e gere comentários `Lucas Review` nos PRs do GitHub.

## Fluxo

Slack `/lucas-review` -> `/api/slack/lucas-review` -> valida assinatura -> comenta no PR -> o agente lê e corrige.

## Criar Slack App

1. Criar Slack App.
2. Criar Slash Command `/lucas-review`.
3. Configurar Request URL:

```txt
https://SEU_DOMINIO/api/slack/lucas-review
```

4. Copiar Slack Signing Secret.
5. Configurar Vercel env vars:

```txt
SLACK_SIGNING_SECRET=
SLACK_ALLOWED_USER_IDS=
SLACK_ALLOWED_CHANNEL_IDS=
GITHUB_REVIEW_TOKEN=
GITHUB_REVIEW_REPO=lspassos1/aframe-kingspan-local
```

6. Fazer redeploy.
7. Testar:

```txt
/lucas-review 141 nao-aprovado O manual stepper ainda é checklist.
```

## Exemplos

```txt
/lucas-review 141 bloqueado O manual stepper precisa virar editor real de ambientes, portas e janelas.
/lucas-review 143 nao-aprovado Redesign interno ainda é refresh superficial.
/lucas-review pr=143 status=nao-aprovado message=Redesign interno ainda parece refresh superficial.
/lucas-review 135 aprovado-para-continuar Pode seguir sem merge automático.
```

## Status

- `nao-aprovado`
- `não-aprovado`
- `bloqueado`
- `aprovado-com-ajustes`
- `aprovado-para-continuar`
- `aprovado-para-merge-manual`

## Segurança

- `SLACK_SIGNING_SECRET` é obrigatório em produção.
- O endpoint valida `X-Slack-Signature` e `X-Slack-Request-Timestamp`.
- Requests com timestamp fora da tolerância de 5 minutos são rejeitados.
- `SLACK_ALLOWED_USER_IDS` e `SLACK_ALLOWED_CHANNEL_IDS` são opcionais e separados por vírgula.
- `GITHUB_REVIEW_TOKEN` é usado para comentar no GitHub.
- Se `GITHUB_REVIEW_TOKEN` estiver ausente, o servidor tenta `GITHUB_FEEDBACK_TOKEN`.
- Nunca usar `NEXT_PUBLIC_*` para Slack ou GitHub tokens.
- Segredos não devem aparecer no client, logs ou resposta de API.

## Gerar Curl De Teste Local

Com `SLACK_SIGNING_SECRET` definido localmente:

```bash
npm run slack:review:test -- 141 nao-aprovado Ajustar o manual stepper.
```

O script apenas gera um `curl` assinado contra `http://localhost:3000/api/slack/lucas-review` para teste manual. Ele não executa o request sozinho e não imprime o signing secret.
