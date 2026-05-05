# Screenshots Da Auditoria Visual

Capturas geradas para a issue [#123](https://github.com/lspassos1/aframe-kingspan-local/issues/123).

Viewports:

- Desktop: `1440x1000`
- Mobile: `390x844`

Sessão:

- Produção validada no in-app browser com login real do Lucas.
- Screenshots versionados capturados no dev server local com sessão Clerk autenticada e projeto exemplo carregado.
- Rotas internas foram capturadas pelo shell autenticado, não como redirect para `/`.
- `/admin/feedback` foi capturada; a autorização admin foi confirmada em Production, mas a lista de melhorias mostrou erro operacional porque `/api/admin/feedback` retornou `502`.
