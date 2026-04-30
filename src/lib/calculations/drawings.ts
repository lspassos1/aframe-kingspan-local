import type { AssemblyDrawing, Project, Scenario } from "@/types/project";
import { calculateAFrameGeometry } from "./geometry";
import { calculateMaterialList } from "./materials";
import { estimateSteelStructure } from "./structure";

const svgWrap = (width: number, height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">${body}</svg>`;

export function generateAssemblyDrawings(project: Project, scenario: Scenario): AssemblyDrawing[] {
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const materials = calculateMaterialList(project, scenario);
  const structural = estimateSteelStructure(project, scenario);
  const scalePlan = Math.min(620 / scenario.terrain.width, 380 / scenario.terrain.depth);
  const terrainW = scenario.terrain.width * scalePlan;
  const terrainD = scenario.terrain.depth * scalePlan;
  const houseW = geometry.baseWidth * scalePlan;
  const houseD = geometry.effectiveHouseDepth * scalePlan;
  const planX = 60;
  const planY = 60;
  const houseX = planX + (terrainW - houseW) / 2;
  const houseY = planY + (terrainD - houseD) / 2;
  const scaleSection = Math.min(460 / geometry.baseWidth, 320 / geometry.ridgeHeight);
  const baseY = 390;
  const leftX = 110;
  const rightX = leftX + geometry.baseWidth * scaleSection;
  const ridgeX = (leftX + rightX) / 2;
  const ridgeY = baseY - geometry.ridgeHeight * scaleSection;
  const dead = geometry.deadZoneEachSide * scaleSection;

  const drawings: AssemblyDrawing[] = [
    {
      id: "cover",
      title: "Capa",
      svg: svgWrap(
        720,
        480,
        `<rect width="720" height="480" fill="#f8fafc"/><text x="48" y="92" font-size="30" font-family="Arial" font-weight="700">Projeto preliminar A-frame</text><text x="48" y="138" font-size="18" font-family="Arial">${project.name}</text><text x="48" y="178" font-size="14" font-family="Arial">${scenario.location.city}, ${scenario.location.state}</text><text x="48" y="420" font-size="12" fill="#9a3412" font-family="Arial">Estimativa preliminar. Nao substitui projeto arquitetonico, estrutural, ART/RRT ou aprovacao municipal.</text>`
      ),
    },
    {
      id: "site-plan",
      title: "Implantacao no lote",
      svg: svgWrap(
        720,
        520,
        `<rect width="720" height="520" fill="#ffffff"/><text x="40" y="32" font-size="20" font-family="Arial" font-weight="700">Implantacao - lote ${scenario.terrain.width} x ${scenario.terrain.depth} m</text><rect x="${planX}" y="${planY}" width="${terrainW}" height="${terrainD}" fill="#ecfdf5" stroke="#0f766e" stroke-width="2"/><rect x="${planX + scenario.terrain.leftSetback * scalePlan}" y="${planY + scenario.terrain.frontSetback * scalePlan}" width="${(scenario.terrain.width - scenario.terrain.leftSetback - scenario.terrain.rightSetback) * scalePlan}" height="${(scenario.terrain.depth - scenario.terrain.frontSetback - scenario.terrain.rearSetback) * scalePlan}" fill="none" stroke="#f59e0b" stroke-dasharray="8 5"/><rect x="${houseX}" y="${houseY}" width="${houseW}" height="${houseD}" fill="#dbeafe" stroke="#1d4ed8" stroke-width="2"/><text x="${houseX + 8}" y="${houseY + 22}" font-size="12" font-family="Arial">Casa ${geometry.baseWidth} x ${geometry.effectiveHouseDepth} m</text><text x="${planX}" y="${planY + terrainD + 28}" font-size="12" font-family="Arial">Recuos: F ${scenario.terrain.frontSetback} m | Fundo ${scenario.terrain.rearSetback} m | Esq ${scenario.terrain.leftSetback} m | Dir ${scenario.terrain.rightSetback} m</text>`
      ),
    },
    {
      id: "front-elevation",
      title: "Elevacao frontal",
      svg: svgWrap(
        720,
        480,
        `<rect width="720" height="480" fill="#fff"/><text x="40" y="36" font-size="20" font-family="Arial" font-weight="700">Elevacao frontal</text><polygon points="${leftX},${baseY} ${ridgeX},${ridgeY} ${rightX},${baseY}" fill="#f8fafc" stroke="#111827" stroke-width="3"/><line x1="${leftX + dead}" y1="${baseY}" x2="${leftX + dead}" y2="${baseY - scenario.aFrame.minimumUsefulHeight * scaleSection}" stroke="#ef4444" stroke-dasharray="5 4"/><line x1="${rightX - dead}" y1="${baseY}" x2="${rightX - dead}" y2="${baseY - scenario.aFrame.minimumUsefulHeight * scaleSection}" stroke="#ef4444" stroke-dasharray="5 4"/><rect x="${leftX + dead}" y="${baseY - 18}" width="${rightX - leftX - 2 * dead}" height="18" fill="#bbf7d0" opacity="0.75"/><text x="${leftX}" y="${baseY + 28}" font-size="12" font-family="Arial">Largura ${geometry.baseWidth} m</text><text x="${ridgeX + 12}" y="${ridgeY + 16}" font-size="12" font-family="Arial">Cumeeira ${geometry.ridgeHeight} m</text><text x="${leftX + dead + 6}" y="${baseY - 26}" font-size="12" fill="#166534" font-family="Arial">Faixa util ${geometry.groundUsefulWidth} m</text>`
      ),
    },
    {
      id: "cross-section",
      title: "Corte transversal e zonas uteis",
      svg: svgWrap(
        720,
        480,
        `<rect width="720" height="480" fill="#fff"/><text x="40" y="36" font-size="20" font-family="Arial" font-weight="700">Corte transversal</text><polygon points="${leftX},${baseY} ${ridgeX},${ridgeY} ${rightX},${baseY}" fill="#eff6ff" stroke="#1f2937" stroke-width="3"/><polygon points="${leftX},${baseY} ${leftX + dead},${baseY} ${leftX + dead},${baseY - scenario.aFrame.minimumUsefulHeight * scaleSection}" fill="#fed7aa" opacity="0.8"/><polygon points="${rightX},${baseY} ${rightX - dead},${baseY} ${rightX - dead},${baseY - scenario.aFrame.minimumUsefulHeight * scaleSection}" fill="#fed7aa" opacity="0.8"/><line x1="${leftX}" y1="${baseY - scenario.aFrame.upperFloorLevelHeight * scaleSection}" x2="${rightX}" y2="${baseY - scenario.aFrame.upperFloorLevelHeight * scaleSection}" stroke="#92400e" stroke-width="4"/><text x="${leftX + 8}" y="${baseY - scenario.aFrame.upperFloorLevelHeight * scaleSection - 10}" font-size="12" font-family="Arial">Pavimento superior h=${scenario.aFrame.upperFloorLevelHeight} m | area ${geometry.upperFloorAreaPercent}%</text><text x="${leftX}" y="${baseY + 28}" font-size="12" font-family="Arial">Zona morta por lado: ${geometry.deadZoneEachSide} m</text>`
      ),
    },
    {
      id: "panel-layout",
      title: "Layout de paineis",
      svg: svgWrap(
        720,
        480,
        `<rect width="720" height="480" fill="#fff"/><text x="40" y="36" font-size="20" font-family="Arial" font-weight="700">Layout de paineis por agua</text><rect x="60" y="80" width="600" height="280" fill="#f8fafc" stroke="#334155"/><text x="72" y="108" font-size="12" font-family="Arial">Painel T1: ${scenario.aFrame.panelLength * 1000} mm x ${scenario.aFrame.panelUsefulWidth * 1000} mm</text>${Array.from({ length: Math.ceil(geometry.effectiveHouseDepth / scenario.aFrame.panelUsefulWidth) + 1 })
          .map((_, index) => {
            const x = 60 + (index * 600) / Math.ceil(geometry.effectiveHouseDepth / scenario.aFrame.panelUsefulWidth);
            return `<line x1="${x}" y1="130" x2="${x}" y2="360" stroke="#94a3b8"/><text x="${x + 3}" y="376" font-size="9" font-family="Arial">P${index + 1}</text>`;
          })
          .join("")}<line x1="82" y1="392" x2="220" y2="392" stroke="#2563eb" stroke-width="3" marker-end="url(#arrow)"/><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#2563eb"/></marker></defs><text x="82" y="418" font-size="12" font-family="Arial">Sentido de montagem ao longo da profundidade</text>`
      ),
    },
    {
      id: "steel-layout",
      title: "Layout estrutural preliminar",
      svg: svgWrap(
        720,
        480,
        `<rect width="720" height="480" fill="#fff"/><text x="40" y="36" font-size="20" font-family="Arial" font-weight="700">Porticos e tercas - preliminar</text><rect x="60" y="80" width="600" height="280" fill="#fff" stroke="#111827"/><text x="72" y="108" font-size="12" font-family="Arial">${structural.frameCount} porticos | espacamento real ${structural.actualFrameSpacingM} m | ${structural.totalSteelKg} kg estimados</text>${Array.from({ length: structural.frameCount })
          .map((_, index) => {
            const x = 60 + (index * 600) / (structural.frameCount - 1);
            return `<line x1="${x}" y1="130" x2="${x}" y2="360" stroke="#111827" stroke-width="2"/>`;
          })
          .join("")}${Array.from({ length: Math.ceil(scenario.aFrame.panelLength / project.structuralInputs.purlinSpacingM) + 1 })
          .map((_, index) => {
            const y = 130 + (index * 230) / Math.ceil(scenario.aFrame.panelLength / project.structuralInputs.purlinSpacingM);
            return `<line x1="60" y1="${y}" x2="660" y2="${y}" stroke="#2563eb" stroke-dasharray="6 4"/>`;
          })
          .join("")}<text x="72" y="408" font-size="12" fill="#9a3412" font-family="Arial">Requer validacao de engenheiro: vento, ligacoes, fundacoes, ancoragens e flambagem.</text>`
      ),
    },
    {
      id: "material-summary",
      title: "Resumo de materiais",
      svg: svgWrap(
        720,
        480,
        `<rect width="720" height="480" fill="#fff"/><text x="40" y="36" font-size="20" font-family="Arial" font-weight="700">Resumo de materiais</text>${materials
          .slice(0, 10)
          .map(
            (line, index) =>
              `<text x="48" y="${78 + index * 30}" font-size="12" font-family="Arial">${line.quantity} ${line.unit} - ${line.code}</text>`
          )
          .join("")}`
      ),
    },
  ];

  return drawings;
}
