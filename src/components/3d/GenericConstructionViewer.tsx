"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls, Text } from "@react-three/drei";
import { Download, Layers3 } from "lucide-react";
import type { Construction3DLayer, Construction3DPrimitive, Construction3DVector3 } from "@/lib/construction-methods";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getGenericConstructionDimensions } from "@/lib/construction-methods/three-dimensions";

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
    camera.position.set(distance, distance * 0.75, -distance);
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
        <Text
          position={[primitive.position[0], primitive.position[1] + primitive.size[1] / 2 + 0.18, primitive.position[2]] as Construction3DVector3}
          fontSize={0.22}
          color="#111827"
          outlineColor="#ffffff"
          outlineWidth={0.008}
        >
          {primitive.label}
        </Text>
      ) : null}
    </group>
  );
}

const br = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function DimensionLine({
  points,
  label,
  labelPosition,
  color,
}: {
  points: Array<[number, number, number]>;
  label: string;
  labelPosition: [number, number, number];
  color: string;
}) {
  return (
    <group>
      <Line points={points} color={color} lineWidth={2} />
      <Text position={labelPosition} fontSize={0.26} color={color} anchorX="center" anchorY="middle" outlineColor="#ffffff" outlineWidth={0.01}>
        {label}
      </Text>
    </group>
  );
}

function DimensionOverlay({ layers }: { layers: Construction3DLayer[] }) {
  const dimensions = getGenericConstructionDimensions(layers);
  if (!dimensions) return null;

  const { footprint, terrain, vertical } = dimensions;
  const dimensionY = 0.18;
  const frontZ = footprint.minZ - 0.72;
  const rightX = footprint.maxX + 0.72;
  const heightX = footprint.minX - 0.72;
  const terrainFrontZ = terrain ? terrain.minZ - 0.5 : frontZ - 0.6;
  const terrainDepthX = terrain ? terrain.minX - 0.5 : heightX - 0.6;
  const terrainWidthM = dimensions.terrainWidthM;
  const terrainDepthM = dimensions.terrainDepthM;

  return (
    <group>
      <DimensionLine
        points={[
          [footprint.minX, dimensionY, frontZ],
          [footprint.maxX, dimensionY, frontZ],
        ]}
        label={`Largura casa ${br.format(dimensions.widthM)} m`}
        labelPosition={[(footprint.minX + footprint.maxX) / 2, 0.48, frontZ]}
        color="#111827"
      />
      <DimensionLine
        points={[
          [rightX, dimensionY, footprint.minZ],
          [rightX, dimensionY, footprint.maxZ],
        ]}
        label={`Prof. casa ${br.format(dimensions.depthM)} m`}
        labelPosition={[rightX + 0.42, 0.48, (footprint.minZ + footprint.maxZ) / 2]}
        color="#111827"
      />
      <DimensionLine
        points={[
          [heightX, 0.08, frontZ],
          [heightX, vertical.maxY, frontZ],
        ]}
        label={`Altura ${br.format(dimensions.heightM)} m`}
        labelPosition={[heightX - 0.42, Math.max(0.7, vertical.maxY / 2), frontZ]}
        color="#7c2d12"
      />
      {terrain && terrainWidthM != null && terrainDepthM != null ? (
        <>
          <DimensionLine
            points={[
              [terrain.minX, 0.1, terrainFrontZ],
              [terrain.maxX, 0.1, terrainFrontZ],
            ]}
            label={`Largura lote ${br.format(terrainWidthM)} m`}
            labelPosition={[(terrain.minX + terrain.maxX) / 2, 0.38, terrainFrontZ]}
            color="#0f766e"
          />
          <DimensionLine
            points={[
              [terrainDepthX, 0.1, terrain.minZ],
              [terrainDepthX, 0.1, terrain.maxZ],
            ]}
            label={`Prof. lote ${br.format(terrainDepthM)} m`}
            labelPosition={[terrainDepthX - 0.42, 0.38, (terrain.minZ + terrain.maxZ) / 2]}
            color="#0f766e"
          />
        </>
      ) : null}
    </group>
  );
}

function GenericScene({
  layers,
  dimensionLayers,
  showDimensions,
}: {
  layers: Construction3DLayer[];
  dimensionLayers: Construction3DLayer[];
  showDimensions: boolean;
}) {
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
      {showDimensions ? <DimensionOverlay layers={dimensionLayers} /> : null}
      <gridHelper args={[40, 40, "#cbd5e1", "#e2e8f0"]} position={[0, 0.01, 0]} />
      <OrbitControls makeDefault enableDamping />
    </>
  );
}

export function GenericConstructionViewer({ layers, title }: { layers: Construction3DLayer[]; title: string }) {
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({});
  const [showDimensions, setShowDimensions] = useState(true);
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
          <GenericScene layers={activeLayers} dimensionLayers={layers} showDimensions={showDimensions} />
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
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <Label htmlFor="generic-dimensions" className="text-sm font-normal">
                Cotas principais
              </Label>
              <Checkbox id="generic-dimensions" checked={showDimensions} onCheckedChange={(value) => setShowDimensions(Boolean(value))} />
            </div>
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
