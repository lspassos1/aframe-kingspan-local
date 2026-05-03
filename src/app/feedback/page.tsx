import { MessageSquare } from "lucide-react";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { FeedbackPrivacyNotice } from "@/components/feedback/FeedbackPrivacyNotice";
import { MyFeedbackStatusList } from "@/components/feedback/MyFeedbackStatusList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FeedbackPage() {
  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
      <section className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Melhorias</p>
          <h1 className="text-3xl font-semibold tracking-normal">Envie uma ideia ou problema do app</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            O envio cria uma issue privada no GitHub do projeto. Nao informe dados sensiveis, documentos pessoais ou informacoes que nao sejam necessarias para entender a melhoria.
          </p>
        </div>
        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Formulario publico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FeedbackForm />
          </CardContent>
        </Card>
        <MyFeedbackStatusList />
      </section>

      <aside className="space-y-4">
        <FeedbackPrivacyNotice />
      </aside>
    </main>
  );
}
