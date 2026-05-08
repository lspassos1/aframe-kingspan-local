"use client";

import Link from "next/link";
import { ArrowRight, Calculator, FileText, Package, Ruler, ShieldAlert, SlidersHorizontal, WalletCards } from "lucide-react";
import { AdvancedDisclosure, BudgetGroupCard, InlineHelp, MetricCard, PageFrame, PageHeader, SectionHeader, StatusPill } from "@/components/shared/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MandatoryWarning } from "@/components/shared/MandatoryWarning";
import { estimateSteelStructure } from "@/lib/calculations/structure";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { formatCurrency } from "@/lib/format";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

const methodAwareLinks = [
  { href: "/technical-project", label: "Projeto técnico", icon: FileText },
  { href: "/materials", label: "Materiais", icon: Package },
  { href: "/budget", label: "Orçamento", icon: Calculator },
];

export default function StructurePage() {
  const project = useProjectStore((state) => state.project);
  const updateStructuralInputs = useProjectStore((state) => state.updateStructuralInputs);
  const updateSteelProfile = useProjectStore((state) => state.updateSteelProfile);
  const scenario = useSelectedScenario();

  if (scenario.constructionMethod !== "aframe") {
    const methodDefinition = getConstructionMethodDefinition(scenario.constructionMethod);

    return (
      <PageFrame>
        <PageHeader
          eyebrow="Estrutura A-frame"
          title={`Estrutura metálica não se aplica a ${methodDefinition.name}`}
          description={`Esta tela calcula pórticos, terças e perfis preliminares apenas para o método A-frame. Para ${methodDefinition.name}, continue pelas rotas do método ativo.`}
          status={<StatusPill tone="info" icon={false}>{methodDefinition.name}</StatusPill>}
        />

        <BudgetGroupCard title="Continuar com o método ativo" description="Use estes atalhos para revisar quantitativos, materiais e orçamento sem abrir cálculo estrutural A-frame.">
          <div className="grid gap-3 md:grid-cols-3">
            {methodAwareLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Button asChild className="justify-between" key={item.href} variant="outline">
                  <Link href={item.href}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              );
            })}
          </div>
        </BudgetGroupCard>
      </PageFrame>
    );
  }

  const estimate = estimateSteelStructure(project, scenario);
  const failedCandidates = estimate.candidates.filter((candidate) => !candidate.pass).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Estrutura A-frame"
        title="Pré-dimensionamento estrutural"
        description="Resumo de decisão para pórticos, aço e custo preliminar. Premissas, fontes e tabelas completas ficam recolhidas."
        status={<StatusPill tone="warning">Revisão técnica</StatusPill>}
      />

      <MandatoryWarning structural />

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Pórticos" value={estimate.frameCount} detail={`Espaçamento real ${estimate.actualFrameSpacingM} m`} icon={<Ruler className="h-4 w-4" />} />
        <MetricCard label="Aço estimado" value={`${estimate.totalSteelKg} kg`} detail={`${estimate.steelKgM2} kg/m²`} icon={<Package className="h-4 w-4" />} />
        <MetricCard label="Perfil principal" value={estimate.selectedMainProfile.name} detail="Candidato preliminar mais leve" tone={failedCandidates > 0 ? "warning" : "success"} />
        <MetricCard
          label="Custo aço"
          value={formatCurrency(estimate.estimatedCostBRL)}
          detail={estimate.usesReferenceSteelPrice ? "Referência por kg até cotação" : "Preço/kg cadastrado"}
          tone="warning"
          icon={<WalletCards className="h-4 w-4" />}
        />
      </section>

      <BudgetGroupCard
        title="Decisão atual"
        description="A estrutura passa apenas por checks simplificados. Use como ordem de grandeza e valide com responsável técnico antes de orçamento executivo."
        status={<StatusPill tone={failedCandidates > 0 ? "warning" : "success"}>{failedCandidates} perfil(is) falhando</StatusPill>}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <InlineHelp tone="warning">Fundação, ligações, travamentos, vento local e detalhamento executivo continuam fora desta aprovação preliminar.</InlineHelp>
          <div className="rounded-2xl border bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Próximo passo</p>
            <p className="mt-2 text-sm leading-6">Preencher preço/kg com fonte, revisar candidatos e exportar memória técnica preliminar.</p>
          </div>
          <div className="rounded-2xl border bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</p>
            <p className="mt-2 text-sm leading-6">Orçamento preliminar, sem aprovação estrutural automática.</p>
          </div>
        </div>
      </BudgetGroupCard>

      <section className="space-y-4">
        <SectionHeader title="Detalhes técnicos" description="Campos e tabelas densas ficam sob demanda para preservar leitura em desktop e mobile." />

        <AdvancedDisclosure
          title="Premissas editáveis"
          description="Altere apenas com referência técnica. Mudanças afetam pórticos, peso e custo estimado."
          icon={SlidersHorizontal}
          badge={<StatusPill tone="neutral">11 campos</StatusPill>}
        >
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["basicWindSpeedMS", "Vento básico (m/s)"],
              ["frameSpacingM", "Esp. pórticos (m)"],
              ["purlinSpacingM", "Esp. terças (m)"],
              ["panelSelfWeightKNM2", "Peso painel (kN/m²)"],
              ["roofMaintenanceLoadKNM2", "Carga manut. (kN/m²)"],
              ["solarPanelLoadKNM2", "Solar (kN/m²)"],
              ["mezzanineDeadLoadKNM2", "Pav. sup. perm. (kN/m²)"],
              ["mezzanineLiveLoadKNM2", "Pav. sup. acidental (kN/m²)"],
              ["referenceSteelPriceBRLKg", "Referência aço (R$/kg)"],
              ["steelGradeFYMPa", "fy aço (MPa)"],
              ["deflectionLimitRatio", "Limite flecha L/"],
            ].map(([key, label]) => (
              <div className="space-y-2" key={key}>
                <Label>{label}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={(project.structuralInputs[key as keyof typeof project.structuralInputs] as number | undefined) ?? ""}
                  onChange={(event) => updateStructuralInputs({ [key]: event.target.value === "" ? undefined : Number(event.target.value) })}
                />
              </div>
            ))}
          </div>
        </AdvancedDisclosure>

        <AdvancedDisclosure
          title="Fontes de preço do aço"
          description="Referências de ordem de grandeza. Cotação formal deve considerar perfil correto, frete, corte, pintura/galvanização e impostos."
          icon={WalletCards}
          badge={<StatusPill tone="neutral">{project.steelPriceSources.length} fonte(s)</StatusPill>}
        >
          <div className="overflow-x-auto">
            <Table className="min-w-[980px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">Fonte</TableHead>
                  <TableHead className="w-28">Região</TableHead>
                  <TableHead className="w-32">Preço ref.</TableHead>
                  <TableHead className="w-72">Perfil de referência</TableHead>
                  <TableHead className="w-72">Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.steelPriceSources.map((source) => (
                  <TableRow key={source.id} className="align-top">
                    <TableCell className="whitespace-normal break-words align-top">
                      <div className="font-medium">{source.label}</div>
                      {source.sourceUrl ? (
                        <a className="text-xs text-primary underline" href={source.sourceUrl} target="_blank" rel="noreferrer">
                          abrir fonte
                        </a>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words align-top">{source.region}</TableCell>
                    <TableCell className="whitespace-normal align-top">
                      {source.priceBRLKg
                        ? `${formatCurrency(source.priceBRLKg)}/kg`
                        : source.priceBRLBar
                          ? `${formatCurrency(source.priceBRLBar)}/barra`
                          : "cotação"}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words align-top">{source.profileReference}</TableCell>
                    <TableCell className="whitespace-normal break-words align-top text-sm text-muted-foreground">{source.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </AdvancedDisclosure>

        <AdvancedDisclosure
          title="Comparação de perfis candidatos"
          description="Tabela de checks simplificados por perfil."
          icon={ShieldAlert}
          badge={<StatusPill tone={failedCandidates > 0 ? "warning" : "success"}>{estimate.candidates.length} candidatos</StatusPill>}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perfil</TableHead>
                  <TableHead>kg/m</TableHead>
                  <TableHead>Utilização</TableHead>
                  <TableHead>Flecha</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimate.candidates.map((candidate) => (
                  <TableRow key={candidate.profile.id}>
                    <TableCell className="font-medium">{candidate.profile.name}</TableCell>
                    <TableCell>{candidate.profile.kgPerM}</TableCell>
                    <TableCell>{candidate.utilizationRatio}</TableCell>
                    <TableCell>{candidate.deflectionRatio}</TableCell>
                    <TableCell>
                      <Badge variant={candidate.pass ? "default" : "destructive"}>{candidate.pass ? "passa" : "falha"}</Badge>
                    </TableCell>
                    <TableCell className="min-w-64 text-sm text-muted-foreground">{candidate.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </AdvancedDisclosure>

        <AdvancedDisclosure
          title="Lista estrutural preliminar"
          description="Membros e perfis estimados para cotação. Não é lista executiva."
          icon={Package}
          badge={<StatusPill tone="neutral">{estimate.members.length} membro(s)</StatusPill>}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membro</TableHead>
                  <TableHead>Qtd.</TableHead>
                  <TableHead>Comprimento total</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>kg/m</TableHead>
                  <TableHead>Preço/kg</TableHead>
                  <TableHead>Utilização</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimate.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="min-w-72">
                      <div className="font-medium">{member.name}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                        <ShieldAlert className="h-3 w-3" />
                        {member.notes}
                      </div>
                    </TableCell>
                    <TableCell>{member.quantity}</TableCell>
                    <TableCell>{member.totalLengthM} m</TableCell>
                    <TableCell>{member.selectedProfile.name}</TableCell>
                    <TableCell>{member.selectedProfile.kgPerM}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 w-28"
                        defaultValue={member.selectedProfile.supplierPriceBRLKg ?? ""}
                        onBlur={(event) =>
                          updateSteelProfile(member.selectedProfile.id, {
                            supplierPriceBRLKg: event.target.value === "" ? undefined : Number(event.target.value),
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>{member.utilizationRatio ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={member.pass ? "default" : "destructive"}>{member.pass ? "preliminar passa" : "revisar"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </AdvancedDisclosure>
      </section>
    </PageFrame>
  );
}
