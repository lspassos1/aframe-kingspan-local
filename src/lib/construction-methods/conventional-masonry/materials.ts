import type { MaterialLine } from "@/types/project";
import type { ConstructionMethodCalculationContext } from "@/lib/construction-methods/types";
import { calculateConventionalMasonryGeometry } from "./geometry";
import { normalizeConventionalMasonryInputs } from "./inputs";

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

export function calculateConventionalMasonryMaterialList(context: ConstructionMethodCalculationContext): MaterialLine[] {
  const geometry = calculateConventionalMasonryGeometry(context);
  const inputs = normalizeConventionalMasonryInputs(context.scenario.methodInputs?.["conventional-masonry"]);
  const blockLabel = inputs.blockType === "ceramic" ? "Bloco ceramico" : "Bloco de concreto";
  const lines: MaterialLine[] = [
    line({
      id: "masonry-blocks",
      code: inputs.blockType,
      description: `${blockLabel} para alvenaria preliminar`,
      category: "civil",
      supplier: "A cotar",
      quantity: geometry.totalBlocks,
      unit: "un",
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: true,
      notes: `${geometry.blocksPerM2} blocos/m2 sobre ${geometry.netMasonryAreaM2} m2 liquidos, com ${inputs.wastePercent}% de perda.`,
    }),
    line({
      id: "masonry-laying-mortar",
      code: "argamassa-assentamento",
      description: "Argamassa de assentamento preliminar",
      category: "civil",
      supplier: "A cotar",
      quantity: geometry.layingMortarM3,
      unit: "m3",
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: true,
      notes: "Coeficiente preliminar de 0,018 m3/m2 de alvenaria liquida.",
    }),
  ];

  if (geometry.internalPlasterAreaM2 > 0) {
    lines.push(
      line({
        id: "masonry-internal-plaster",
        code: "reboco-interno",
        description: "Chapisco/emboço/reboco interno preliminar",
        category: "civil",
        supplier: "A cotar",
        quantity: geometry.internalPlasterAreaM2,
        unit: "m2",
        wasteIncluded: true,
        manualOverride: false,
        requiresConfirmation: true,
        notes: "Area preliminar de revestimento interno; confirmar vãos, shafts e especificacao executiva.",
      })
    );
  }

  if (geometry.externalPlasterAreaM2 > 0) {
    lines.push(
      line({
        id: "masonry-external-plaster",
        code: "reboco-externo",
        description: "Chapisco/emboço/reboco externo preliminar",
        category: "civil",
        supplier: "A cotar",
        quantity: geometry.externalPlasterAreaM2,
        unit: "m2",
        wasteIncluded: true,
        manualOverride: false,
        requiresConfirmation: true,
        notes: "Area preliminar de revestimento externo; confirmar acabamento e exposicao.",
      })
    );
  }

  if (geometry.subfloorAreaM2 > 0) {
    lines.push(
      line({
        id: "masonry-subfloor",
        code: "contrapiso",
        description: "Contrapiso preliminar",
        category: "civil",
        supplier: "A cotar",
        quantity: geometry.subfloorAreaM2,
        unit: "m2",
        wasteIncluded: true,
        manualOverride: false,
        requiresConfirmation: true,
        notes: "Area de piso por pavimento com perda aplicada.",
      })
    );
  }

  lines.push(
    line({
      id: "masonry-foundation-placeholder",
      code: inputs.foundationType,
      description: "Fundacao preliminar",
      category: "civil",
      supplier: "A confirmar",
      quantity: 1,
      unit: "lot",
      wasteIncluded: false,
      manualOverride: false,
      requiresConfirmation: true,
      notes: "Placeholder; depende de sondagem e projeto estrutural.",
    }),
    line({
      id: "masonry-roof-placeholder",
      code: inputs.roofType,
      description: "Cobertura/laje preliminar",
      category: "civil",
      supplier: "A confirmar",
      quantity: geometry.builtAreaM2,
      unit: "m2",
      wasteIncluded: false,
      manualOverride: false,
      requiresConfirmation: true,
      notes: "Placeholder; confirmar sistema de cobertura/laje em projeto.",
    })
  );

  return lines;
}
