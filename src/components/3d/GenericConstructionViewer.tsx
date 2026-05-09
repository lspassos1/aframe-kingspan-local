"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls, Text } from "@react-three/drei";
import { Camera, Download, Eye, RotateCcw, Settings2 } from "lucide-react";
import { Mobile3DControls, Mobile3DPreview, type Mobile3DOpeningPreview, type Mobile3DViewMode, useMobile3DViewport } from "@/components/3d/Mobile3DControls";
import type { Construction3DLayer, Construction3DPrimitive, Construction3DVector3 } from "@/lib/construction-methods";
import type { Scenario } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { getGeneric3DNumberControls } from "@/lib/construction-methods/generic-3d-controls";
import { getGenericViewerFramingLayers } from "@/lib/construction-methods/generic-viewer-framing";
import { getScenarioMethodInputs } from "@/lib/construction-methods";
import { getGenericConstructionDimensions } from "@/lib/construction-methods/three-dimensions";
import { useProjectStore } from "@/lib/store/project-store";
import { createGenericMobile3DSummary } from "@/lib/model-3d/mobile-summary";

type ViewMode = Mobile3DViewMode;
type DimensionMode = "basic" | "detailed";

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

function CameraView({ layers, view }: { layers: Construction3DLayer[]; view: ViewMode }) {
  const { camera } = useThree();
  const distance = maxDimensionFromLayers(layers) * 1.15;
  const dimensions = getGenericConstructionDimensions(layers);
  const targetY = dimensions ? dimensions.heightM / 2 : distance * 0.16;

  useEffect(() => {
    const positions: Record<ViewMode, [number, number, number]> = {
      iso: [distance, distance * 0.75, -distance],
      top: [0, distance * 1.35, 0.01],
      front: [0, Math.max(2.2, targetY), -distance],
      rear: [0, Math.max(2.2, targetY), distance],
      side: [distance, Math.max(2.2, targetY), 0],
      section: [distance * 0.85, Math.max(2.2, targetY), -distance * 0.35],
    };
    camera.position.set(...positions[view]);
    camera.lookAt(0, targetY, 0);
    camera.updateProjectionMatrix();
  }, [camera, distance, targetY, view]);

  return null;
}

function PrimitiveMesh({ layer, modelOpacity, primitive }: { layer: Construction3DLayer; modelOpacity: number; primitive: Construction3DPrimitive }) {
  const primitiveOpacity = primitive.opacity ?? 1;
  const opacity = layer.type === "terrain" || layer.type === "openings" ? primitiveOpacity : Math.min(primitiveOpacity, modelOpacity);

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

function DimensionOverlay({ layers, mode }: { layers: Construction3DLayer[]; mode: DimensionMode }) {
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
      {mode === "basic" ? (
        <>
          <Text position={[0, 0.48, frontZ]} fontSize={0.34} color="#111827" anchorX="center" anchorY="middle" outlineColor="#ffffff" outlineWidth={0.012}>
            {`Casa ${br.format(dimensions.widthM)} m x ${br.format(dimensions.depthM)} m`}
          </Text>
          <Text position={[0, vertical.maxY + 0.45, frontZ]} fontSize={0.32} color="#7c2d12" anchorX="center" anchorY="middle" outlineColor="#ffffff" outlineWidth={0.012}>
            {`Altura ${br.format(dimensions.heightM)} m`}
          </Text>
          {terrainWidthM != null && terrainDepthM != null ? (
            <Text position={[0, 0.38, terrainFrontZ]} fontSize={0.3} color="#0f766e" anchorX="center" anchorY="middle" outlineColor="#ffffff" outlineWidth={0.012}>
              {`Lote ${br.format(terrainWidthM)} m x ${br.format(terrainDepthM)} m`}
            </Text>
          ) : null}
        </>
      ) : null}
      {mode === "detailed" ? (
        <>
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
        </>
      ) : null}
      {mode === "detailed" && terrain && terrainWidthM != null && terrainDepthM != null ? (
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
  dimensionMode,
  modelOpacity,
  showDimensions,
  view,
}: {
  layers: Construction3DLayer[];
  dimensionMode: DimensionMode;
  modelOpacity: number;
  showDimensions: boolean;
  view: ViewMode;
}) {
  const framingLayers = getGenericViewerFramingLayers(layers, showDimensions);

  return (
    <>
      <CameraView layers={framingLayers} view={view} />
      <ambientLight intensity={0.72} />
      <directionalLight position={[8, 12, 8]} intensity={1.15} castShadow />
      {layers.map((layer) => (
        <group key={layer.id}>
          {layer.data.primitives.map((primitive) => (
            <PrimitiveMesh key={`${layer.id}-${primitive.id}`} layer={layer} modelOpacity={modelOpacity} primitive={primitive} />
          ))}
        </group>
      ))}
      {showDimensions ? <DimensionOverlay layers={layers} mode={dimensionMode} /> : null}
      <gridHelper args={[40, 40, "#cbd5e1", "#e2e8f0"]} position={[0, 0.01, 0]} />
      <OrbitControls makeDefault enableDamping />
    </>
  );
}

function NumberControl({
  label,
  max,
  min,
  onChange,
  step,
  unit,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
}) {
  const displayValue = Number.isInteger(step) ? Math.round(value) : value;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <div className="flex items-center gap-1">
          <Input type="number" min={min} max={max} step={step} value={displayValue} onChange={(event) => onChange(Number(event.target.value))} className="h-8 w-24" />
          {unit ? <span className="w-5 text-xs text-muted-foreground">{unit}</span> : null}
        </div>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([nextValue]) => onChange(nextValue)} />
    </div>
  );
}

function createOpeningPreview(layers: Construction3DLayer[]): Mobile3DOpeningPreview | undefined {
  const openingPrimitives = layers.filter((layer) => layer.type === "openings").flatMap((layer) => layer.data.primitives);
  if (!openingPrimitives.length) return undefined;

  return {
    doorCount: openingPrimitives.filter((primitive) => primitive.label === "Porta" || primitive.id.includes("door")).length,
    windowCount: openingPrimitives.filter((primitive) => primitive.label === "Janela" || primitive.id.includes("window")).length,
  };
}

export function GenericConstructionViewer({ layers, scenario, title }: { layers: Construction3DLayer[]; scenario: Scenario; title: string }) {
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({});
  const [showDimensions, setShowDimensions] = useState(true);
  const [view, setView] = useState<ViewMode>("iso");
  const [dimensionMode, setDimensionMode] = useState<DimensionMode>("detailed");
  const [modelOpacity, setModelOpacity] = useState(0.78);
  const [canvasFallback, setCanvasFallback] = useState<{ key: string; unavailable: boolean }>({ key: "", unavailable: false });
  const updateScenarioMethodInputs = useProjectStore((state) => state.updateScenarioMethodInputs);
  const updateScenarioTerrain = useProjectStore((state) => state.updateScenarioTerrain);
  const isMobileViewport = useMobile3DViewport();
  const methodInputs = useMemo(() => getScenarioMethodInputs(scenario), [scenario]);
  const numberControls = useMemo(() => getGeneric3DNumberControls(scenario.constructionMethod, methodInputs), [methodInputs, scenario.constructionMethod]);
  const activeLayers = useMemo(() => layers.filter((layer) => visibleLayers[layer.id] ?? layer.visibleByDefault), [layers, visibleLayers]);
  const canvasFallbackKey = `${scenario.id}:${scenario.constructionMethod}:${layers.map((layer) => layer.id).join("|")}`;
  const canvasUnavailable = canvasFallback.key === canvasFallbackKey && canvasFallback.unavailable;
  const openingPreview = useMemo(() => createOpeningPreview(activeLayers), [activeLayers]);
  const mobileSummary = useMemo(() => createGenericMobile3DSummary(activeLayers), [activeLayers]);

  const toggleLayer = (layerId: string, checked: boolean) => {
    setVisibleLayers((current) => ({ ...current, [layerId]: checked }));
  };

  const updateMethodNumber = (key: string, value: number) => {
    if (!Number.isFinite(value)) return;
    updateScenarioMethodInputs(scenario.id, scenario.constructionMethod, { ...methodInputs, [key]: value });
  };

  const updateTerrain = (updates: Partial<Scenario["terrain"]>) => {
    updateScenarioTerrain(scenario.id, { ...scenario.terrain, ...updates });
  };

  const screenshot = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.download = "modelo-3d-metodo.png";
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  };

  const mobileAdvancedControls = (
    <>
      <div className="space-y-2">
        <Label>Modo de cotas</Label>
        <Select value={dimensionMode} onValueChange={(value) => setDimensionMode(value as DimensionMode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="basic">Basico</SelectItem>
            <SelectItem value="detailed">Detalhado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Transparencia volumes</Label>
          <span className="text-xs text-muted-foreground">{Math.round(modelOpacity * 100)}%</span>
        </div>
        <Slider min={0.25} max={1} step={0.01} value={[modelOpacity]} onValueChange={([value]) => setModelOpacity(value)} />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
          <Label htmlFor="mobile-generic-dimensions" className="text-sm font-normal">
            Cotas principais
          </Label>
          <Checkbox id="mobile-generic-dimensions" checked={showDimensions} onCheckedChange={(value) => setShowDimensions(Boolean(value))} />
        </div>
        {layers.map((layer) => (
          <div key={layer.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
            <Label htmlFor={`mobile-${layer.id}`} className="text-sm font-normal">
              {layer.label}
            </Label>
            <Checkbox id={`mobile-${layer.id}`} checked={visibleLayers[layer.id] ?? layer.visibleByDefault} onCheckedChange={(value) => toggleLayer(layer.id, Boolean(value))} />
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="h-[58svh] min-h-[360px] max-h-[520px] overflow-hidden rounded-2xl border bg-slate-50 xl:h-auto xl:max-h-none xl:min-h-[680px] xl:rounded-md">
        {isMobileViewport ? (
          <Mobile3DPreview openings={openingPreview} subtitle="Volume leve por camadas. Use as vistas rápidas e abra camadas/cotas sob demanda." title={title} view={view} />
        ) : canvasUnavailable ? (
          <Mobile3DPreview
            badge="Prévia 3D simplificada"
            openings={openingPreview}
            subtitle="WebGL ficou indisponível neste navegador; a prévia mantém volume e aberturas manuais aproximadas."
            title={title}
            view={view}
          />
        ) : (
          <Canvas
            camera={{ position: [16, 12, 16], fov: 45 }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener("webglcontextlost", () => setCanvasFallback({ key: canvasFallbackKey, unavailable: true }), { once: true });
            }}
            shadows
          >
            <GenericScene
              layers={activeLayers}
              dimensionMode={dimensionMode}
              modelOpacity={modelOpacity}
              showDimensions={showDimensions}
              view={view}
            />
          </Canvas>
        )}
      </div>
      <Mobile3DControls
        advancedControls={mobileAdvancedControls}
        onScreenshot={screenshot}
        onViewChange={setView}
        showScreenshotAction={!isMobileViewport}
        summary={mobileSummary}
        view={view}
      />
      <aside className="hidden space-y-4 xl:sticky xl:top-6 xl:block xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-1">
        <div className="rounded-md border bg-card">
          <div className="mb-3 flex items-center gap-2 font-medium">
            <div className="flex w-full items-center gap-2 px-4 pt-4">
              <Settings2 className="h-4 w-4" />
              Geometria do metodo
            </div>
          </div>
          <div className="max-h-[min(640px,calc(100vh-9rem))] overflow-y-auto overflow-x-hidden px-4 pb-6 pr-5">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{title}</p>
              {numberControls.map((control) => (
                <NumberControl
                  key={control.key}
                  label={control.label}
                  max={control.max}
                  min={control.min}
                  onChange={(value) => updateMethodNumber(control.key, value)}
                  step={control.step}
                  unit={control.unit}
                  value={control.value}
                />
              ))}
              <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3">
                <div className="space-y-2">
                  <Label>Largura lote</Label>
                  <Input type="number" step={0.1} value={scenario.terrain.width} onChange={(event) => updateTerrain({ width: Number(event.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Prof. lote</Label>
                  <Input type="number" step={0.1} value={scenario.terrain.depth} onChange={(event) => updateTerrain({ depth: Number(event.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Recuo frente</Label>
                  <Input type="number" step={0.1} value={scenario.terrain.frontSetback} onChange={(event) => updateTerrain({ frontSetback: Number(event.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Recuo lateral</Label>
                  <Input
                    type="number"
                    step={0.1}
                    value={scenario.terrain.leftSetback}
                    onChange={(event) => updateTerrain({ leftSetback: Number(event.target.value), rightSetback: Number(event.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Modo de cotas</Label>
                <Select value={dimensionMode} onValueChange={(value) => setDimensionMode(value as DimensionMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basico</SelectItem>
                    <SelectItem value="detailed">Detalhado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Transparencia volumes</Label>
                  <span className="text-xs text-muted-foreground">{Math.round(modelOpacity * 100)}%</span>
                </div>
                <Slider min={0.25} max={1} step={0.01} value={[modelOpacity]} onValueChange={([value]) => setModelOpacity(value)} />
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-md border p-4">
          <div className="mb-3 flex items-center gap-2 font-medium">
            <Camera className="h-4 w-4" />
            Vistas
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["iso", "Isometrica"],
              ["top", "Topo"],
              ["front", "Frontal"],
              ["rear", "Posterior"],
              ["side", "Lateral"],
              ["section", "Corte"],
            ].map(([id, label]) => (
              <Button key={id} type="button" variant={view === id ? "default" : "outline"} size="sm" onClick={() => setView(id as ViewMode)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setView("iso")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={screenshot}>
              <Download className="mr-2 h-4 w-4" />
              PNG
            </Button>
          </div>
        </div>
        <div className="rounded-md border p-4">
          <div className="mb-3 flex items-center gap-2 font-medium">
            <Eye className="h-4 w-4" />
            Camadas
          </div>
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
