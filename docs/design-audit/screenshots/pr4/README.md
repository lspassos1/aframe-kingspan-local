# Screenshots Do PR 4

Capturas do PR `feat/start-design-reset`, relacionado à issue [#126](https://github.com/lspassos1/aframe-kingspan-local/issues/126).

Viewports:

- Desktop: `1440x1000`
- Mobile: `390x844`

Sessão:

- Dev server local em `http://localhost:3000`.
- Rota `/start` em estado inicial com sessão Clerk autenticada real, porque o `proxy.ts` protege `/start`.
- Rota `/start?mode=ai` capturada para validar upload, status OpenAI, cache, limite e fallback manual.
- Browser local disponível via Playwright validou os três caminhos e confirmou que a primeira camada não mostra método construtivo.
- PNGs gerados por Playwright local com token de sign-in temporário do Clerk.

Rotas capturadas:

- `/start`
- `/start?mode=ai`
