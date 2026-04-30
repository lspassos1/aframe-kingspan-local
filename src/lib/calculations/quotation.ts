import type { Project, QuotationRequest, Scenario } from "@/types/project";
import { calculateAFrameGeometry } from "./geometry";
import { calculateMaterialList } from "./materials";
import { estimateSteelStructure } from "./structure";

const br = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function generateQuotationRequests(project: Project, scenario: Scenario): QuotationRequest[] {
  const panel = project.panelProducts.find((item) => item.id === scenario.panelProductId) ?? project.panelProducts[0];
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const materials = calculateMaterialList(project, scenario);
  const structural = estimateSteelStructure(project, scenario);
  const address = [scenario.location.address, scenario.location.city, scenario.location.state, scenario.location.country]
    .filter(Boolean)
    .join(", ");
  const generatedAt = new Date().toISOString();

  const panelLines = materials
    .filter((line) => ["panels", "fasteners", "flashings", "sealants"].includes(line.category))
    .map((line) => `- ${line.quantity} ${line.unit} | ${line.code} | ${line.description}`)
    .join("\n");
  const steelLines = structural.members
    .map(
      (member) =>
        `- ${member.name}: ${member.quantity} un, ${br.format(member.lengthM)} m cada, ${br.format(member.totalLengthM)} m total, perfil ${member.selectedProfile.name}, ${member.selectedProfile.kgPerM} kg/m`
    )
    .join("\n");

  return [
    {
      id: "rfq-panels",
      title: "Pedido de cotacao - Paineis Kingspan/KingRoofing",
      supplierCategory: "Fornecedor de paineis",
      generatedAt,
      body: `Prezados,\n\nSolicito cotacao para um estudo de casa A-frame com paineis sanduiche.\n\nProjeto: ${project.name}\nEndereco/local: ${address || "a confirmar"}\nLote: ${scenario.terrain.width} m x ${scenario.terrain.depth} m\nCasa: ${geometry.baseWidth} m largura x ${geometry.effectiveHouseDepth} m profundidade x ${geometry.ridgeHeight} m cumeeira\nPainel desejado: ${panel.productName}\nNucleo: ${panel.coreType}\nEspessura: ${scenario.aFrame.panelThickness} mm\nComprimento: ${scenario.aFrame.panelLength} m\nLargura util: ${scenario.aFrame.panelUsefulWidth} m\nCor externa: ${scenario.externalColor}\nAcabamento interno: ${scenario.internalFinish}\n\nItens para cotacao:\n${panelLines}\n\nFavor informar:\n- disponibilidade dos comprimentos e cores;\n- confirmacao tecnica para uso em planos inclinados A-frame;\n- kit de fixacao recomendado;\n- ficha tecnica;\n- prazo de fabricacao;\n- frete separado para o endereco informado;\n- condicoes de pagamento;\n- validade da proposta.\n\nObservacao: este pedido e para estudo preliminar e nao substitui validacao tecnica do fornecedor nem projeto de engenharia.`,
    },
    {
      id: "rfq-steel",
      title: "Pedido de cotacao - Perfis metalicos",
      supplierCategory: "Fornecedor de aco",
      generatedAt,
      body: `Prezados,\n\nSolicito cotacao de perfis metalicos para pre-estudo de estrutura A-frame.\n\nProjeto: ${project.name}\nEndereco/local: ${address || "a confirmar"}\nPeso preliminar estimado: ${br.format(structural.totalSteelKg)} kg\nAcabamento desejado: ${project.structuralInputs.corrosionProtection}\n\nLista preliminar:\n${steelLines}\n\nFavor informar preco por kg ou por barra, comprimento comercial, disponibilidade, corte, galvanizacao/pintura, entrega no endereco informado, prazo e condicoes de pagamento.\n\nImportante: a lista e preliminar. O dimensionamento final sera feito por engenheiro habilitado.`,
    },
    {
      id: "rfq-fabricator",
      title: "Pedido de cotacao - Fabricacao e montagem metalica",
      supplierCategory: "Serralheiro/fabricante metalico",
      generatedAt,
      body: `Prezados,\n\nSolicito proposta preliminar para fabricacao e eventual montagem de estrutura metalica de casa A-frame.\n\nProjeto: ${project.name}\nLocal: ${address || "a confirmar"}\nPorticos A-frame: ${structural.frameCount} unidades\nEspacamento aproximado: ${br.format(structural.actualFrameSpacingM)} m\nProfundidade da casa: ${geometry.effectiveHouseDepth} m\nAltura de cumeeira: ${geometry.ridgeHeight} m\nPeso preliminar estimado: ${br.format(structural.totalSteelKg)} kg\n\nEscopo para avaliar:\n- porticos A-frame;\n- tercas;\n- contraventamentos;\n- chapas de base e ligacao;\n- chumbadores;\n- pintura ou galvanizacao;\n- transporte;\n- montagem no local.\n\nFavor separar material, fabricacao, pintura/galvanizacao, transporte, montagem, prazo e condicoes de pagamento.\n\nA estrutura devera ser validada por engenheiro habilitado antes da execucao.`,
    },
    {
      id: "rfq-general",
      title: "Pedido de cotacao - Orcamento geral preliminar",
      supplierCategory: "Orcamento geral",
      generatedAt,
      body: `Projeto preliminar de casa A-frame para estudo de viabilidade.\n\nLocal: ${address || "a confirmar"}\nLote: ${scenario.terrain.width} m x ${scenario.terrain.depth} m\nArea total estimada: ${geometry.combinedTotalArea} m2\nArea util estimada: ${geometry.combinedUsefulArea} m2\n\nItens ainda a cotar separadamente:\n- fundacao/radier e drenagem;\n- mao de obra;\n- equipamentos de icamento e andaimes;\n- fechamento frontal/posterior;\n- portas e janelas;\n- projetos tecnicos, ART/RRT e aprovacao municipal;\n- contingencia.\n\nSolicito valores separados por categoria e premissas usadas na proposta.`,
    },
  ];
}
