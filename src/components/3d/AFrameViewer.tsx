"use client";

import { useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls, Text } from "@react-three/drei";
import { Camera, Download, Eye, RotateCcw, Settings2 } from "lucide-react";
import type { AFrameGeometry, Project, Scenario } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { useProjectStore } from "@/lib/store/project-store";
import { coerceAFrameToPanel, getPanelExternalOptions, getPanelInternalOptions, getPanelLengthOptions } from "@/lib/panels";

type ViewMode = "iso" | "top" | "front" | "rear" | "side" | "section";
type DimensionMode = "basic" | "detailed";

interface ToggleState {
  panels: boolean;
  steel: boolean;
  purlins: boolean;
  upperFloor: boolean;
  terrain: boolean;
  deadZones: boolean;
  usefulAreas: boolean;
  dimensions: boolean;
  mountingDirection: boolean;
  slopeDirection: boolean;
  panelNumbers: boolean;
}

const defaultToggles: ToggleState = {
  panels: true,
  steel: true,
  purlins: true,
  upperFloor: true,
  terrain: true,
  deadZones: true,
  usefulAreas: true,
  dimensions: true,
  mountingDirection: true,
  slopeDirection: true,
  panelNumbers: false,
};

function CameraView({ view, geometry, scenario }: { view: ViewMode; geometry: AFrameGeometry; scenario: Scenario }) {
  const { camera } = useThree();
  useEffect(() => {
    const distance = Math.max(scenario.terrain.width, scenario.terrain.depth, geometry.ridgeHeight) * 1.2;
    const positions: Record<ViewMode, [number, number, number]> = {
      iso: [distance, distance * 0.75, distance],
      top: [0, distance * 1.4, 0.01],
      front: [0, geometry.ridgeHeight * 0.65, distance],
      rear: [0, geometry.ridgeHeight * 0.65, -distance],
      side: [distance, geometry.ridgeHeight * 0.65, 0],
      section: [distance * 0.85, geometry.ridgeHeight * 0.7, distance * 0.35],
    };
    camera.position.set(...positions[view]);
    camera.lookAt(0, geometry.ridgeHeight / 2, 0);
    camera.updateProjectionMatrix();
  }, [camera, geometry.ridgeHeight, scenario.terrain.depth, scenario.terrain.width, view]);
  return null;
}

function SlopePlane({
  side,
  geometry,
  scenario,
  color,
  showRibs,
  opacity,
}: {
  side: "left" | "right";
  geometry: AFrameGeometry;
  scenario: Scenario;
  color: string;
  showRibs: boolean;
  opacity: number;
}) {
  const angle = (scenario.aFrame.baseAngleDeg * Math.PI) / 180;
  const rotation = side === "left" ? angle : -angle;
  const x = side === "left" ? -geometry.baseWidth / 4 : geometry.baseWidth / 4;
  const y = geometry.ridgeHeight / 2;
  const seamCount = Math.ceil(geometry.effectiveHouseDepth / scenario.aFrame.panelUsefulWidth);
  const ribCount = Math.ceil(geometry.effectiveHouseDepth / 0.25);
  const zStart = -geometry.effectiveHouseDepth / 2;

  return (
    <group>
      <mesh position={[x, y, 0]} rotation={[0, 0, rotation]} castShadow receiveShadow>
        <boxGeometry args={[scenario.aFrame.panelLength, 0.08, geometry.effectiveHouseDepth]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.18} transparent opacity={opacity} depthWrite={opacity > 0.88} />
      </mesh>
      {Array.from({ length: seamCount + 1 }).map((_, index) => {
        const z = zStart + index * scenario.aFrame.panelUsefulWidth;
        return (
          <mesh key={`seam-${side}-${index}`} position={[x, y + 0.035, z]} rotation={[0, 0, rotation]}>
            <boxGeometry args={[scenario.aFrame.panelLength, 0.035, 0.025]} />
            <meshStandardMaterial color="#475569" roughness={0.4} transparent opacity={Math.min(0.75, opacity + 0.18)} />
          </mesh>
        );
      })}
      {showRibs
        ? Array.from({ length: ribCount + 1 }).map((_, index) => {
            const z = zStart + index * 0.25;
            return (
                <mesh key={`rib-${side}-${index}`} position={[x, y + 0.06, z]} rotation={[0, 0, rotation]}>
                  <boxGeometry args={[scenario.aFrame.panelLength, 0.025, 0.012]} />
                  <meshStandardMaterial color="#d1d5db" roughness={0.45} transparent opacity={Math.min(0.72, opacity + 0.12)} />
                </mesh>
            );
          })
        : null}
    </group>
  );
}

function DimensionLine({
  points,
  label,
  labelPosition,
  color = "#111827",
}: {
  points: Array<[number, number, number]>;
  label: string;
  labelPosition: [number, number, number];
  color?: string;
}) {
  return (
    <group>
      <Line points={points} color={color} lineWidth={2} />
      <Text position={labelPosition} fontSize={0.24} color={color} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

function AFrameScene({
  project,
  scenario,
  toggles,
  view,
  panelOpacity,
  dimensionMode,
}: {
  project: Project;
  scenario: Scenario;
  toggles: ToggleState;
  view: ViewMode;
  panelOpacity: number;
  dimensionMode: DimensionMode;
}) {
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const panel = project.panelProducts.find((item) => item.id === scenario.panelProductId) ?? project.panelProducts[0];
  const frames = Math.max(2, Math.ceil(geometry.effectiveHouseDepth / project.structuralInputs.frameSpacingM) + 1);
  const purlinRows = Math.ceil(scenario.aFrame.panelLength / project.structuralInputs.purlinSpacingM) + 1;
  const zStart = -geometry.effectiveHouseDepth / 2;
  const steelInset = Math.min(0.35, geometry.baseWidth * 0.04);
  const steelBaseY = 0.2;
  const steelRidgeY = Math.max(steelBaseY + 0.5, geometry.ridgeHeight - steelInset);
  const leftSteelBaseX = -geometry.baseWidth / 2 + steelInset;
  const rightSteelBaseX = geometry.baseWidth / 2 - steelInset;

  return (
    <>
      <CameraView view={view} geometry={geometry} scenario={scenario} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 12, 10]} intensity={1.2} castShadow />
      {toggles.terrain ? (
        <group>
          <mesh position={[0, -0.03, 0]} receiveShadow>
            <boxGeometry args={[scenario.terrain.width, 0.04, scenario.terrain.depth]} />
            <meshStandardMaterial color="#e8f5e9" roughness={0.8} />
          </mesh>
          <Line
            points={[
              [-scenario.terrain.width / 2, 0.02, -scenario.terrain.depth / 2],
              [scenario.terrain.width / 2, 0.02, -scenario.terrain.depth / 2],
              [scenario.terrain.width / 2, 0.02, scenario.terrain.depth / 2],
              [-scenario.terrain.width / 2, 0.02, scenario.terrain.depth / 2],
              [-scenario.terrain.width / 2, 0.02, -scenario.terrain.depth / 2],
            ]}
            color="#0f766e"
            lineWidth={2}
          />
          <Line
            points={[
              [-scenario.terrain.width / 2 + scenario.terrain.leftSetback, 0.04, -scenario.terrain.depth / 2 + scenario.terrain.frontSetback],
              [scenario.terrain.width / 2 - scenario.terrain.rightSetback, 0.04, -scenario.terrain.depth / 2 + scenario.terrain.frontSetback],
              [scenario.terrain.width / 2 - scenario.terrain.rightSetback, 0.04, scenario.terrain.depth / 2 - scenario.terrain.rearSetback],
              [-scenario.terrain.width / 2 + scenario.terrain.leftSetback, 0.04, scenario.terrain.depth / 2 - scenario.terrain.rearSetback],
              [-scenario.terrain.width / 2 + scenario.terrain.leftSetback, 0.04, -scenario.terrain.depth / 2 + scenario.terrain.frontSetback],
            ]}
            color="#f59e0b"
            lineWidth={1.5}
            dashed
          />
        </group>
      ) : null}

      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[geometry.baseWidth, 0.06, geometry.effectiveHouseDepth]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.7} />
      </mesh>

      {toggles.usefulAreas ? (
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[geometry.groundUsefulWidth, 0.03, geometry.effectiveHouseDepth]} />
          <meshStandardMaterial color="#22c55e" transparent opacity={0.28} />
        </mesh>
      ) : null}
      {toggles.deadZones ? (
        <>
          <mesh position={[-geometry.baseWidth / 2 + geometry.deadZoneEachSide / 2, 0.1, 0]}>
            <boxGeometry args={[geometry.deadZoneEachSide, 0.05, geometry.effectiveHouseDepth]} />
            <meshStandardMaterial color="#f97316" transparent opacity={0.35} />
          </mesh>
          <mesh position={[geometry.baseWidth / 2 - geometry.deadZoneEachSide / 2, 0.1, 0]}>
            <boxGeometry args={[geometry.deadZoneEachSide, 0.05, geometry.effectiveHouseDepth]} />
            <meshStandardMaterial color="#f97316" transparent opacity={0.35} />
          </mesh>
        </>
      ) : null}

      {toggles.panels ? (
        <>
          <SlopePlane
            side="left"
            geometry={geometry}
            scenario={scenario}
            color={scenario.externalColor || panel.colorHex}
            showRibs
            opacity={panelOpacity}
          />
          <SlopePlane
            side="right"
            geometry={geometry}
            scenario={scenario}
            color={scenario.externalColor || panel.colorHex}
            showRibs
            opacity={panelOpacity}
          />
        </>
      ) : null}

      {toggles.steel ? (
        <group>
          {Array.from({ length: frames }).map((_, index) => {
            const z = zStart + (index * geometry.effectiveHouseDepth) / (frames - 1);
            return (
              <Line
                key={`frame-${index}`}
                points={[
                  [leftSteelBaseX, steelBaseY, z],
                  [0, steelRidgeY, z],
                  [rightSteelBaseX, steelBaseY, z],
                ]}
                color="#111827"
                lineWidth={3}
              />
            );
          })}
        </group>
      ) : null}

      {toggles.purlins ? (
        <group>
          {Array.from({ length: purlinRows }).map((_, index) => {
            const t = index / Math.max(1, purlinRows - 1);
            const leftX = leftSteelBaseX + (0 - leftSteelBaseX) * t;
            const rightX = rightSteelBaseX + (0 - rightSteelBaseX) * t;
            const y = steelBaseY + (steelRidgeY - steelBaseY) * t;
            return (
              <group key={`purlin-${index}`}>
                <Line points={[[leftX, y + 0.06, zStart], [leftX, y + 0.06, -zStart]]} color="#2563eb" lineWidth={2} />
                <Line points={[[rightX, y + 0.06, zStart], [rightX, y + 0.06, -zStart]]} color="#2563eb" lineWidth={2} />
              </group>
            );
          })}
        </group>
      ) : null}

      {toggles.upperFloor && geometry.upperFloorTotalArea > 0 ? (
        <group>
          <mesh position={[0, scenario.aFrame.upperFloorLevelHeight, -geometry.effectiveHouseDepth / 2 + geometry.upperFloorDepth / 2]}>
            <boxGeometry args={[geometry.upperFloorTotalWidth, 0.16, geometry.upperFloorDepth]} />
            <meshStandardMaterial color="#b7791f" roughness={0.7} transparent opacity={0.78} />
          </mesh>
        </group>
      ) : null}

      {toggles.dimensions ? (
        <group>
          <Text position={[0, 0.25, geometry.effectiveHouseDepth / 2 + 0.65]} fontSize={0.35} color="#111827">
            {`Casa ${geometry.baseWidth} m x ${geometry.effectiveHouseDepth} m`}
          </Text>
          <Text position={[0, geometry.ridgeHeight + 0.45, 0]} fontSize={0.35} color="#111827">
            {`Cumeeira ${geometry.ridgeHeight} m`}
          </Text>
          <Text position={[0, 0.25, -scenario.terrain.depth / 2 - 0.6]} fontSize={0.32} color="#0f766e">
            {`Lote ${scenario.terrain.width} m x ${scenario.terrain.depth} m`}
          </Text>
          {dimensionMode === "detailed" ? (
            <>
              <DimensionLine
                points={[
                  [-geometry.baseWidth / 2, 0.16, geometry.effectiveHouseDepth / 2 + 0.4],
                  [geometry.baseWidth / 2, 0.16, geometry.effectiveHouseDepth / 2 + 0.4],
                ]}
                label={`Largura casa ${geometry.baseWidth} m`}
                labelPosition={[0, 0.42, geometry.effectiveHouseDepth / 2 + 0.4]}
                color="#111827"
              />
              <DimensionLine
                points={[
                  [geometry.baseWidth / 2 + 0.55, 0.16, -geometry.effectiveHouseDepth / 2],
                  [geometry.baseWidth / 2 + 0.55, 0.16, geometry.effectiveHouseDepth / 2],
                ]}
                label={`Prof. ${geometry.effectiveHouseDepth} m`}
                labelPosition={[geometry.baseWidth / 2 + 0.9, 0.45, 0]}
                color="#111827"
              />
              <DimensionLine
                points={[
                  [-geometry.baseWidth / 2 - 0.55, 0.16, 0],
                  [-geometry.baseWidth / 2 - 0.55, geometry.ridgeHeight, 0],
                ]}
                label={`Altura ${geometry.ridgeHeight} m`}
                labelPosition={[-geometry.baseWidth / 2 - 0.9, geometry.ridgeHeight / 2, 0]}
                color="#7c2d12"
              />
              <DimensionLine
                points={[
                  [-geometry.groundUsefulWidth / 2, 0.18, -geometry.effectiveHouseDepth / 2 - 0.35],
                  [geometry.groundUsefulWidth / 2, 0.18, -geometry.effectiveHouseDepth / 2 - 0.35],
                ]}
                label={`Largura util terreo ${geometry.groundUsefulWidth} m`}
                labelPosition={[0, 0.45, -geometry.effectiveHouseDepth / 2 - 0.35]}
                color="#15803d"
              />
              {geometry.upperFloorTotalArea > 0 ? (
                <>
                  <DimensionLine
                    points={[
                      [-geometry.upperFloorTotalWidth / 2, scenario.aFrame.upperFloorLevelHeight + 0.2, -geometry.effectiveHouseDepth / 2 + geometry.upperFloorDepth + 0.25],
                      [geometry.upperFloorTotalWidth / 2, scenario.aFrame.upperFloorLevelHeight + 0.2, -geometry.effectiveHouseDepth / 2 + geometry.upperFloorDepth + 0.25],
                    ]}
                    label={`Largura sup. ${geometry.upperFloorTotalWidth} m`}
                    labelPosition={[0, scenario.aFrame.upperFloorLevelHeight + 0.5, -geometry.effectiveHouseDepth / 2 + geometry.upperFloorDepth + 0.25]}
                    color="#92400e"
                  />
                  <DimensionLine
                    points={[
                      [0, 0.16, -geometry.effectiveHouseDepth / 2 - 0.65],
                      [0, scenario.aFrame.upperFloorLevelHeight, -geometry.effectiveHouseDepth / 2 - 0.65],
                    ]}
                    label={`Piso superior ${scenario.aFrame.upperFloorLevelHeight} m`}
                    labelPosition={[0.75, scenario.aFrame.upperFloorLevelHeight / 2, -geometry.effectiveHouseDepth / 2 - 0.65]}
                    color="#92400e"
                  />
                </>
              ) : null}
              <DimensionLine
                points={[
                  [-scenario.terrain.width / 2, 0.08, scenario.terrain.depth / 2 + 0.45],
                  [scenario.terrain.width / 2, 0.08, scenario.terrain.depth / 2 + 0.45],
                ]}
                label={`Largura lote ${scenario.terrain.width} m`}
                labelPosition={[0, 0.35, scenario.terrain.depth / 2 + 0.45]}
                color="#0f766e"
              />
              <DimensionLine
                points={[
                  [-scenario.terrain.width / 2 - 0.45, 0.08, -scenario.terrain.depth / 2],
                  [-scenario.terrain.width / 2 - 0.45, 0.08, scenario.terrain.depth / 2],
                ]}
                label={`Prof. lote ${scenario.terrain.depth} m`}
                labelPosition={[-scenario.terrain.width / 2 - 0.85, 0.35, 0]}
                color="#0f766e"
              />
            </>
          ) : null}
        </group>
      ) : null}

      {toggles.mountingDirection ? (
        <Line points={[[-1.5, 0.25, zStart + 1], [1.5, 0.25, zStart + 1]]} color="#7c3aed" lineWidth={4} />
      ) : null}
      {toggles.slopeDirection ? (
        <Line points={[[0, geometry.ridgeHeight + 0.15, 0], [geometry.baseWidth / 2, 0.35, 0]]} color="#dc2626" lineWidth={4} />
      ) : null}
      {toggles.panelNumbers
        ? Array.from({ length: Math.ceil(geometry.effectiveHouseDepth / scenario.aFrame.panelUsefulWidth) }).map((_, index) => (
            <Text key={`pn-${index}`} position={[0, geometry.ridgeHeight + 0.08, zStart + index * scenario.aFrame.panelUsefulWidth + 0.4]} fontSize={0.22} color="#111827">
              {`T${index + 1}`}
            </Text>
          ))
        : null}
      <gridHelper args={[40, 40, "#cbd5e1", "#e2e8f0"]} position={[0, 0.01, 0]} />
      <OrbitControls makeDefault enableDamping />
    </>
  );
}

export function AFrameViewer({ project, scenario }: { project: Project; scenario: Scenario }) {
  const [toggles, setToggles] = useState<ToggleState>(defaultToggles);
  const [view, setView] = useState<ViewMode>("iso");
  const [panelOpacity, setPanelOpacity] = useState(0.46);
  const [dimensionMode, setDimensionMode] = useState<DimensionMode>("detailed");
  const updateScenarioAFrame = useProjectStore((state) => state.updateScenarioAFrame);
  const updateScenarioTerrain = useProjectStore((state) => state.updateScenarioTerrain);
  const updateScenarioPanel = useProjectStore((state) => state.updateScenarioPanel);
  const panel = project.panelProducts.find((item) => item.id === scenario.panelProductId) ?? project.panelProducts[0];
  const lengthOptions = getPanelLengthOptions(panel);

  const updateToggle = (key: keyof ToggleState, checked: boolean) => {
    setToggles((current) => ({ ...current, [key]: checked }));
  };

  const updateAFrame = (updates: Partial<Scenario["aFrame"]>) => {
    updateScenarioAFrame(scenario.id, { ...scenario.aFrame, ...updates });
  };

  const updateTerrain = (updates: Partial<Scenario["terrain"]>) => {
    updateScenarioTerrain(scenario.id, { ...scenario.terrain, ...updates });
  };

  const selectPanel = (panelProductId: string) => {
    const selected = project.panelProducts.find((item) => item.id === panelProductId);
    if (!selected) return;
    const nextAFrame = coerceAFrameToPanel(scenario.aFrame, selected);
    const externalColor = String(getPanelExternalOptions(selected)[0]?.value ?? selected.colorHex);
    const internalFinish = String(getPanelInternalOptions(selected)[0]?.value ?? scenario.internalFinish);
    updateScenarioAFrame(scenario.id, nextAFrame);
    updateScenarioPanel(scenario.id, selected.id, externalColor, internalFinish);
  };

  const screenshot = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.download = "modelo-3d-aframe.png";
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-h-[680px] overflow-hidden rounded-md border bg-slate-50">
        <Canvas shadows camera={{ position: [18, 12, 18], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
          <AFrameScene project={project} scenario={scenario} toggles={toggles} view={view} panelOpacity={panelOpacity} dimensionMode={dimensionMode} />
        </Canvas>
      </div>
      <aside className="space-y-4">
        <div className="rounded-md border p-4">
          <div className="mb-3 flex items-center gap-2 font-medium">
            <Settings2 className="h-4 w-4" />
            Geometria e painel
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={scenario.panelProductId} onValueChange={selectPanel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {project.panelProducts.map((item) => (
                    <SelectItem value={item.id} key={item.id}>
                      {item.productName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comprimento do painel</Label>
              {panel.isCustom ? (
                <Input
                  type="number"
                  step="0.1"
                  value={scenario.aFrame.panelLength}
                  onChange={(event) => updateAFrame({ panelLength: Number(event.target.value) })}
                />
              ) : (
                <Select value={String(scenario.aFrame.panelLength)} onValueChange={(value) => updateAFrame({ panelLength: Number(value) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lengthOptions.map((value) => (
                      <SelectItem value={String(value)} key={value}>
                        {value.toLocaleString("pt-BR")} m
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">{panel.constraintsNote ?? panel.notes}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Angulo</Label>
                <Input
                  type="number"
                  min={35}
                  max={75}
                  step={1}
                  value={scenario.aFrame.baseAngleDeg}
                  onChange={(event) => updateAFrame({ baseAngleDeg: Number(event.target.value) })}
                  className="h-8 w-20"
                />
              </div>
              <Slider
                min={35}
                max={75}
                step={1}
                value={[scenario.aFrame.baseAngleDeg]}
                onValueChange={([value]) => updateAFrame({ baseAngleDeg: value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Prof. casa</Label>
                <Input
                  type="number"
                  min={2}
                  step={0.1}
                  value={scenario.aFrame.houseDepth}
                  onChange={(event) => updateAFrame({ houseDepth: Number(event.target.value), automaticDepth: false })}
                />
              </div>
              <div className="space-y-2">
                <Label>Altura util min.</Label>
                <Input
                  type="number"
                  min={1}
                  max={2.3}
                  step={0.05}
                  value={scenario.aFrame.minimumUsefulHeight}
                  onChange={(event) => updateAFrame({ minimumUsefulHeight: Number(event.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Pav. superior</Label>
                <Select
                  value={scenario.aFrame.upperFloorMode}
                  onValueChange={(value) => updateAFrame({ upperFloorMode: value as Scenario["aFrame"]["upperFloorMode"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem</SelectItem>
                    <SelectItem value="full-floor">Completo</SelectItem>
                    <SelectItem value="mezzanine-percent">Percentual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Area sup. %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  disabled={scenario.aFrame.upperFloorMode !== "mezzanine-percent"}
                  value={scenario.aFrame.upperFloorAreaPercent}
                  onChange={(event) => updateAFrame({ upperFloorAreaPercent: Number(event.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Altura piso superior</Label>
                <Input
                  type="number"
                  min={1.8}
                  max={5}
                  step={0.05}
                  value={scenario.aFrame.upperFloorLevelHeight}
                  onChange={(event) => updateAFrame({ upperFloorLevelHeight: Number(event.target.value) })}
                  className="h-8 w-24"
                />
              </div>
              <Slider
                min={1.8}
                max={5}
                step={0.05}
                value={[scenario.aFrame.upperFloorLevelHeight]}
                onValueChange={([value]) => updateAFrame({ upperFloorLevelHeight: value })}
              />
            </div>
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
                <Label>Transparencia telhas</Label>
                <span className="text-xs text-muted-foreground">{Math.round(panelOpacity * 100)}%</span>
              </div>
              <Slider min={0.25} max={0.95} step={0.01} value={[panelOpacity]} onValueChange={([value]) => setPanelOpacity(value)} />
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
          <div className="grid gap-3">
            {(Object.keys(toggles) as Array<keyof ToggleState>).map((key) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <Label htmlFor={key} className="text-sm">
                  {toggleLabels[key]}
                </Label>
                <Checkbox id={key} checked={toggles[key]} onCheckedChange={(checked) => updateToggle(key, Boolean(checked))} />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

const toggleLabels: Record<keyof ToggleState, string> = {
  panels: "Paineis",
  steel: "Estrutura",
  purlins: "Tercas",
  upperFloor: "Pavimento superior",
  terrain: "Terreno e recuos",
  deadZones: "Zonas mortas",
  usefulAreas: "Areas uteis",
  dimensions: "Cotas principais",
  mountingDirection: "Sentido montagem",
  slopeDirection: "Sentido inclinacao",
  panelNumbers: "Numeracao paineis",
};
