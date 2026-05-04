"use client";

import { useMemo } from "react";
import { AFrameViewer } from "@/components/3d/AFrameViewer";
import { GenericConstructionViewer } from "@/components/3d/GenericConstructionViewer";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

export default function Model3DPage() {
  const project = useProjectStore((state) => state.project);
  const scenario = useSelectedScenario();
  const methodDefinition = getConstructionMethodDefinition(scenario.constructionMethod);
  const isAFrame = scenario.constructionMethod === "aframe";
  const layers = useMemo(() => methodDefinition.generate3DLayers?.({ project, scenario }) ?? [], [methodDefinition, project, scenario]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Modelo 3D</p>
        <h1 className="text-3xl font-semibold tracking-normal">Visualizacao interativa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isAFrame
            ? "Terreno editavel, recuos, paineis trapezoidais, estrutura interna, tercas, pavimento superior opcional, zonas mortas, areas uteis e cotas principais."
            : "Modelo volumetrico simplificado por camadas para leitura preliminar do metodo construtivo selecionado."}
        </p>
      </div>
      {isAFrame ? <AFrameViewer project={project} scenario={scenario} /> : <GenericConstructionViewer title={methodDefinition.name} layers={layers} />}
    </div>
  );
}
