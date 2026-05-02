import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center px-4 py-10">
      <div className="grid w-full gap-8 lg:grid-cols-[0.8fr_1fr] lg:items-center">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Entrar</p>
          <h1 className="text-3xl font-semibold tracking-normal">Acesse seus estudos no navegador deste dispositivo.</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            A autenticacao e gerenciada pelo Clerk. Este app nao recebe nem armazena sua senha, hashes de senha ou tokens OAuth.
          </p>
        </div>
        <div className="flex justify-center">
          <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" forceRedirectUrl="/start" />
        </div>
      </div>
    </main>
  );
}
