# Login, privacidade e dados pessoais

## Modelo adotado

O app usa Clerk para autenticação. O aplicativo não armazena senha, hash de senha, token OAuth, refresh token ou credencial social em banco próprio.

Dados tratados:

- Email e sessão de autenticação: gerenciados pelo Clerk.
- Dados de projeto: salvos no LocalStorage do navegador do usuário.
- Feedback público: enviado para uma issue privada no GitHub quando `GITHUB_FEEDBACK_TOKEN` estiver configurado.

## Dados que o app evita armazenar

- Documento pessoal.
- Dados de pagamento.
- Endereço completo obrigatório.
- Arquivos de projeto em servidor próprio.
- Histórico de orçamentos pessoais em banco remoto.

## Variáveis de ambiente

Obrigatórias para login:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/start`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/start`

Obrigatórias para feedback:

- `GITHUB_FEEDBACK_TOKEN`
- `GITHUB_FEEDBACK_REPO`

O token do GitHub deve ter a menor permissão possível para criar issues no repositório privado.

## Direitos autorais

O vídeo e poster da landing page são gerados a partir de desenho próprio do app. Não usar imagens de catálogos Kingspan/KingRoofing sem licença.

Marcas e nomes de fornecedores podem aparecer apenas como referência técnica, catálogo ou cotação informada pelo usuário.

## Limite técnico

Esta entrega não implementa banco de projetos por usuário. Se o usuário trocar de navegador ou limpar dados locais, o projeto salvo no LocalStorage pode ser perdido, salvo se exportado para JSON.
