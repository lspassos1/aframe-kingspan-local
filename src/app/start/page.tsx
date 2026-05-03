import { StartProjectForm } from "@/components/onboarding/StartProjectForm";

export default function StartPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Inicio do projeto</p>
        <h1 className="text-3xl font-semibold tracking-normal">Configure o minimo para rodar o 3D</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Depois desta etapa voce pode ajustar recuos, pavimento superior, fundacao, estrutura, materiais e precos nas abas internas.
        </p>
      </div>
      <StartProjectForm />
    </div>
  );
}
