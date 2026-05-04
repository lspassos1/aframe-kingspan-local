import type { MaterialLine } from "@/types/project";
import type { ConstructionMethodCalculationContext } from "@/lib/construction-methods/types";
import { calculateEcoBlockGeometry } from "./geometry";
import { normalizeEcoBlockInputs } from "./inputs";

const emptyCost = {
  unitPriceBRL: undefined,
  grossTotalBRL: 0,
  discountBRL: 0,
  netTotalBRL: 0,
} as const;

function line(input: Omit<MaterialLine, "unitPriceBRL" | "grossTotalBRL" | "discountBRL" | "netTotalBRL">): MaterialLine {
  return {
    ...input,
    ...emptyCost,
  };
}

export function calculateEcoBlockMaterialList(context: ConstructionMethodCalculationContext): MaterialLine[] {
  const geometry = calculateEcoBlockGeometry(context);
  const inputs = normalizeEcoBlockInputs(context.scenario.methodInputs?.["eco-block"]);
  const lines: MaterialLine[] = [
    line({
      id: "eco-blocks",
      code: "solo-cimento",
      description: "Blocos/tijolos solo-cimento preliminares",
      category: "civil",
      supplier: "A cotar",
      quantity: geometry.totalBlocks,
      unit: "un",
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: true,
      notes: `${inputs.blocksPerM2} blocos/m2 sobre ${geometry.netWallAreaM2} m2 liquidos, com ${inputs.wastePercent}% de perda.`,
    }),
    line({
      id: "eco-special-blocks",
      code: "canaletas-especiais",
      description: "Blocos especiais/canaletas preliminares",
      category: "civil",
      supplier: "A cotar",
      quantity: geometry.specialBlocks,
      unit: "un",
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: true,
      notes: "Percentual preliminar para canaletas, ajustes, vergas e detalhes de fiadas.",
    }),
    line({
      id: "eco-adhesive-mortar",
      code: "argamassa-cola",
      description: "Argamassa/cola de assentamento preliminar",
      category: "civil",
      supplier: "A cotar",
      quantity: geometry.adhesiveMortarKg,
      unit: "kg",
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: true,
      notes: "Coeficiente preliminar por area liquida de parede.",
    }),
  ];

  if (geometry.groutM3 > 0) {
    lines.push(
      line({
        id: "eco-grout",
        code: "graute",
        description: "Graute preliminar",
        category: "civil",
        supplier: "A cotar",
        quantity: geometry.groutM3,
        unit: "m3",
        wasteIncluded: true,
        manualOverride: false,
        requiresConfirmation: true,
        notes: "Volume preliminar; depende do sistema, furos preenchidos e projeto.",
      })
    );
  }

  for (const [id, description, quantity] of [
    ["eco-vertical-steel", "Aco vertical preliminar", geometry.verticalSteelKg],
    ["eco-horizontal-steel", "Aco horizontal/canaletas preliminar", geometry.horizontalSteelKg],
  ] as const) {
    if (quantity > 0) {
      lines.push(
        line({
          id,
          code: id,
          description,
          category: "steel",
          supplier: "A cotar",
          quantity,
          unit: "kg",
          wasteIncluded: true,
          manualOverride: false,
          requiresConfirmation: true,
          notes: "Estimativa preliminar; exige projeto e detalhamento.",
        })
      );
    }
  }

  if (geometry.baseWaterproofingM2 > 0) {
    lines.push(
      line({
        id: "eco-base-waterproofing",
        code: "impermeabilizacao-base",
        description: "Impermeabilizacao da primeira fiada",
        category: "civil",
        supplier: "A cotar",
        quantity: geometry.baseWaterproofingM2,
        unit: "m2",
        wasteIncluded: true,
        manualOverride: false,
        requiresConfirmation: true,
        notes: "Faixa preliminar na base das paredes.",
      })
    );
  }

  if (geometry.plasterAreaM2 > 0) {
    lines.push(
      line({
        id: "eco-plaster",
        code: "reboco",
        description: "Reboco preliminar para bloco nao aparente",
        category: "civil",
        supplier: "A cotar",
        quantity: geometry.plasterAreaM2,
        unit: "m2",
        wasteIncluded: true,
        manualOverride: false,
        requiresConfirmation: true,
        notes: "Aplicado apenas quando acabamento rebocado esta selecionado.",
      })
    );
  }

  return lines;
}
