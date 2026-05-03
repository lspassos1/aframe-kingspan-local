import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Privacidade</p>
          <h1 className="text-3xl font-semibold tracking-normal">Dados minimos para autenticacao e estudo local.</h1>
        </div>
        <div className="prose prose-slate max-w-none space-y-5 text-sm leading-7 text-muted-foreground">
          <p>
            Esta ferramenta foi desenhada para reduzir coleta de dados pessoais. O app nao armazena senhas, hashes de senha,
            tokens OAuth, refresh tokens ou credenciais sociais.
          </p>
          <p>
            A autenticacao e gerenciada pelo Clerk. O email usado para login fica no provedor de autenticacao e e usado apenas
            para identificar a sessao. Projetos, medidas, cenarios e orcamentos continuam salvos no navegador do usuario por
            LocalStorage nesta versao.
          </p>
          <p>
            O formulario de melhorias nao exige email. Se voce preencher contato opcional, esse dado sera incluido na issue privada
            do repositorio para permitir retorno sobre a sugestao.
          </p>
          <p>
            Nao usamos dados para publicidade, venda de leads ou enriquecimento comercial. Precos, cotacoes e fornecedores devem
            ser confirmados formalmente pelo usuario.
          </p>
          <p>
            Para remover dados locais do projeto, use os controles de reset/exportacao do app ou limpe os dados do site no navegador.
            Para duvidas sobre autenticacao, revise tambem as configuracoes da sua conta no Clerk.
          </p>
        </div>
        <Link href="/terms" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Ver termos de uso
        </Link>
      </div>
    </main>
  );
}
