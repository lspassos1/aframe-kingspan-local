"use client";

import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MandatoryWarning } from "@/components/shared/MandatoryWarning";
import { estimateSteelStructure } from "@/lib/calculations/structure";
import { formatCurrency } from "@/lib/format";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

export default function StructurePage() {
  const project = useProjectStore((state) => state.project);
  const updateStructuralInputs = useProjectStore((state) => state.updateStructuralInputs);
  const updateSteelProfile = useProjectStore((state) => state.updateSteelProfile);
  const scenario = useSelectedScenario();
  const estimate = estimateSteelStructure(project, scenario);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Estrutura Metalica</p>
        <h1 className="text-3xl font-semibold tracking-normal">Pre-dimensionamento estrutural</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O modulo compara perfis candidatos e escolhe a opcao preliminar mais leve que passa em checks simplificados.
        </p>
      </div>

      <MandatoryWarning structural />

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Porticos</p>
            <p className="mt-2 text-2xl font-semibold">{estimate.frameCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">Esp. real {estimate.actualFrameSpacingM} m</p>
          </CardContent>
        </Card>
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Aco estimado</p>
            <p className="mt-2 text-2xl font-semibold">{estimate.totalSteelKg} kg</p>
            <p className="mt-1 text-xs text-muted-foreground">{estimate.steelKgM2} kg/m2</p>
          </CardContent>
        </Card>
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Perfil principal</p>
            <p className="mt-2 text-lg font-semibold">{estimate.selectedMainProfile.name}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Custo aço</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(estimate.estimatedCostBRL)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {estimate.usesReferenceSteelPrice ? "Usa referencia por kg ate cotacao formal" : "Calculado com preco/kg cadastrado"}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle>Premissas editaveis</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["basicWindSpeedMS", "Vento basico (m/s)"],
            ["frameSpacingM", "Esp. porticos (m)"],
            ["purlinSpacingM", "Esp. tercas (m)"],
            ["panelSelfWeightKNM2", "Peso painel (kN/m2)"],
            ["roofMaintenanceLoadKNM2", "Carga manut. (kN/m2)"],
            ["solarPanelLoadKNM2", "Solar (kN/m2)"],
            ["mezzanineDeadLoadKNM2", "Pav. sup. perm. (kN/m2)"],
            ["mezzanineLiveLoadKNM2", "Pav. sup. acidental (kN/m2)"],
            ["referenceSteelPriceBRLKg", "Referencia aco (R$/kg)"],
            ["steelGradeFYMPa", "fy aco (MPa)"],
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
        </CardContent>
      </Card>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle>Fontes de preco do aco</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Estas fontes servem apenas para ordem de grandeza. O preco final deve vir de cotacao do perfil correto, com frete, corte, pintura/galvanizacao e impostos.
          </p>
          <div className="overflow-x-auto">
            <Table className="min-w-[980px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">Fonte</TableHead>
                  <TableHead className="w-28">Regiao</TableHead>
                  <TableHead className="w-32">Preco ref.</TableHead>
                  <TableHead className="w-72">Perfil de referencia</TableHead>
                  <TableHead className="w-72">Observacao</TableHead>
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
                          : "cotacao"}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words align-top">{source.profileReference}</TableCell>
                    <TableCell className="whitespace-normal break-words align-top text-sm text-muted-foreground">{source.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle>Comparacao de perfis candidatos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Perfil</TableHead>
                <TableHead>kg/m</TableHead>
                <TableHead>Utilizacao</TableHead>
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
        </CardContent>
      </Card>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle>Lista estrutural preliminar</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Qtd.</TableHead>
                <TableHead>Comprimento total</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>kg/m</TableHead>
                <TableHead>Preco/kg</TableHead>
                <TableHead>Utilizacao</TableHead>
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
        </CardContent>
      </Card>
    </div>
  );
}
