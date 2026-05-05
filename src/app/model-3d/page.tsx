"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { PageFrame, PageHeader, PendingState, StatusPill } from "@/components/shared/design-system";
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
    <PageFrame>
      <PageHeader
        eyebrow="Modelo 3D"
        title="Visualização interativa"
        status={<StatusPill tone="info" icon={false}>{methodDefinition.name}</StatusPill>}
        description={
          <>
          {isAFrame
            ? "Terreno editavel, recuos, paineis trapezoidais, estrutura interna, tercas, pavimento superior opcional, zonas mortas, areas uteis e cotas principais."
            : "Modelo volumetrico simplificado por camadas para leitura preliminar do metodo construtivo selecionado."}
          </>
        }
      />
      {isAFrame ? <AFrameViewer project={project} scenario={scenario} /> : <GenericConstructionViewer scenario={scenario} title={methodDefinition.name} layers={layers} />}
    </PageFrame>
  );
}

function ViewerLoading() {
  return <PendingState title="Carregando visualização 3D..." className="min-h-[480px]" />;
}
