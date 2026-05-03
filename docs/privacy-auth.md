# Login, privacidade e dados pessoais

## Modelo adotado no MVP

O app usa Clerk para autenticacao. O aplicativo nao armazena senha, hash de senha, token OAuth, refresh token ou credencial social em banco proprio.

Dados tratados:

- Email e sessao de autenticacao: gerenciados pelo Clerk.
- Dados de projeto: salvos no LocalStorage do navegador do usuario.
- Feedback publico: enviado para uma issue privada no GitHub quando `GITHUB_FEEDBACK_TOKEN` estiver configurado.

## Dados que o app evita armazenar

- Documento pessoal.
- Dados de pagamento.
- Endereco completo obrigatorio.
- Arquivos de projeto em servidor proprio.
- Historico de orcamentos pessoais em banco remoto.

## Variaveis de ambiente

Obrigatorias para login:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/start`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/start`

Obrigatorias para feedback:

- `GITHUB_FEEDBACK_TOKEN`
- `GITHUB_FEEDBACK_REPO`

O token do GitHub deve ter a menor permissao possivel para criar issues no repositorio privado.

## Direitos autorais

O video e poster da landing page sao gerados a partir de desenho proprio do app. Nao usar imagens de catalogos Kingspan/KingRoofing sem licenca.

Marcas e nomes de fornecedores podem aparecer apenas como referencia tecnica, catalogo ou cotacao informada pelo usuario.

## Limite tecnico

Este MVP nao implementa banco de projetos por usuario. Se o usuario trocar de navegador ou limpar dados locais, o projeto salvo no LocalStorage pode ser perdido, salvo se exportado para JSON.
