"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

const AFrameViewer = dynamic(() => import("@/components/3d/AFrameViewer").then((module) => module.AFrameViewer), {
  ssr: false,
  loading: () => <ViewerLoading />,
});

const GenericConstructionViewer = dynamic(() => import("@/components/3d/GenericConstructionViewer").then((module) => module.GenericConstructionViewer), {
  ssr: false,
  loading: () => <ViewerLoading />,
});

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
      {isAFrame ? <AFrameViewer project={project} scenario={scenario} /> : <GenericConstructionViewer scenario={scenario} title={methodDefinition.name} layers={layers} />}
    </div>
  );
}

function ViewerLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="grid min-h-[480px] place-items-center rounded-md border bg-muted/20 text-sm text-muted-foreground"
    >
      Carregando visualizacao 3D...
    </div>
  );
}
