import { StartProjectForm } from "@/components/onboarding/StartProjectForm";

export default function StartPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Inicio do projeto</p>
        <h1 className="text-3xl font-semibold tracking-normal">Escolha o metodo e configure o estudo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A-frame ja abre o 3D completo. Os demais metodos entram como MVP preliminar enquanto os calculos especificos sao adicionados.
        </p>
      </div>
      <StartProjectForm />
    </div>
  );
}
