import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center px-4 py-10">
      <div className="grid w-full gap-8 lg:grid-cols-[0.8fr_1fr] lg:items-center">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Criar conta</p>
          <h1 className="text-3xl font-semibold tracking-normal">Comece com o minimo de dados pessoais.</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Usamos Clerk para login com Google e email/senha. O app nao recebe nem armazena credenciais OAuth.
          </p>
        </div>
        <div className="flex justify-center">
          <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/start" />
        </div>
      </div>
    </main>
  );
}
