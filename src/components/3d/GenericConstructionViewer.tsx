"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { Download, Layers3 } from "lucide-react";
import type { Construction3DLayer, Construction3DPrimitive, Construction3DVector3 } from "@/lib/construction-methods";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

function maxDimensionFromLayers(layers: Construction3DLayer[]) {
  return Math.max(
    8,
    ...layers.flatMap((layer) =>
      layer.data.primitives.flatMap((primitive) => [
        Math.abs(primitive.position[0]) + primitive.size[0],
        Math.abs(primitive.position[1]) + primitive.size[1],
        Math.abs(primitive.position[2]) + primitive.size[2],
      ])
    )
  );
}

function CameraView({ layers }: { layers: Construction3DLayer[] }) {
  const { camera } = useThree();
  const distance = maxDimensionFromLayers(layers) * 1.15;

  useEffect(() => {
    camera.position.set(distance, distance * 0.75, distance);
    camera.lookAt(0, distance * 0.16, 0);
    camera.updateProjectionMatrix();
  }, [camera, distance]);

  return null;
}

function PrimitiveMesh({ primitive }: { primitive: Construction3DPrimitive }) {
  const opacity = primitive.opacity ?? 1;

  return (
    <group>
      <mesh position={primitive.position} castShadow receiveShadow>
        <boxGeometry args={primitive.size} />
        <meshStandardMaterial color={primitive.color} roughness={0.62} transparent={opacity < 1} opacity={opacity} wireframe={primitive.wireframe} />
      </mesh>
      {primitive.label ? (
        <Text position={[primitive.position[0], primitive.position[1] + primitive.size[1] / 2 + 0.18, primitive.position[2]] as Construction3DVector3} fontSize={0.22} color="#111827">
          {primitive.label}
        </Text>
      ) : null}
    </group>
  );
}

function GenericScene({ layers }: { layers: Construction3DLayer[] }) {
  return (
    <>
      <CameraView layers={layers} />
      <ambientLight intensity={0.72} />
      <directionalLight position={[8, 12, 8]} intensity={1.15} castShadow />
      {layers.map((layer) => (
        <group key={layer.id}>
          {layer.data.primitives.map((primitive) => (
            <PrimitiveMesh key={`${layer.id}-${primitive.id}`} primitive={primitive} />
          ))}
        </group>
      ))}
      <gridHelper args={[40, 40, "#cbd5e1", "#e2e8f0"]} position={[0, 0.01, 0]} />
      <OrbitControls makeDefault enableDamping />
    </>
  );
}

export function GenericConstructionViewer({ layers, title }: { layers: Construction3DLayer[]; title: string }) {
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({});
  const activeLayers = useMemo(() => layers.filter((layer) => visibleLayers[layer.id] ?? layer.visibleByDefault), [layers, visibleLayers]);

  const toggleLayer = (layerId: string, checked: boolean) => {
    setVisibleLayers((current) => ({ ...current, [layerId]: checked }));
  };

  const screenshot = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.download = "modelo-3d-metodo.png";
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-h-[640px] overflow-hidden rounded-md border bg-slate-50">
        <Canvas shadows camera={{ position: [16, 12, 16], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
          <GenericScene layers={activeLayers} />
        </Canvas>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
        <div className="rounded-md border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-medium">
              <Layers3 className="h-4 w-4" />
              Camadas
            </div>
            <Button variant="outline" size="sm" onClick={screenshot}>
              <Download className="mr-2 h-4 w-4" />
              PNG
            </Button>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{title}</p>
          <div className="space-y-3">
            {layers.map((layer) => (
              <div key={layer.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <Label htmlFor={layer.id} className="text-sm font-normal">
                  {layer.label}
                </Label>
                <Checkbox id={layer.id} checked={visibleLayers[layer.id] ?? layer.visibleByDefault} onCheckedChange={(value) => toggleLayer(layer.id, Boolean(value))} />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
