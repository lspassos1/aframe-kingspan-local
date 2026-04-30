"use client";

import { AFrameViewer } from "@/components/3d/AFrameViewer";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

export default function Model3DPage() {
  const project = useProjectStore((state) => state.project);
  const scenario = useSelectedScenario();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Modelo 3D</p>
        <h1 className="text-3xl font-semibold tracking-normal">Visualizacao interativa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Terreno editavel, recuos, paineis trapezoidais, estrutura interna, tercas, pavimento superior opcional, zonas mortas, areas uteis e cotas principais.
        </p>
      </div>
      <AFrameViewer project={project} scenario={scenario} />
    </div>
  );
}
