"use client";

import { Boxes, Building2, Package, Plus, SlidersHorizontal, Trash2, WalletCards } from "lucide-react";
import { AdvancedDisclosure, BudgetGroupCard, MetricCard, PageFrame, PageHeader, SectionHeader, StatusPill } from "@/components/shared/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjectStore } from "@/lib/store/project-store";

const numberOrUndefined = (value: string) => (value === "" ? undefined : Number(value));

export default function SettingsPage() {
  const project = useProjectStore((state) => state.project);
  const updatePanelProduct = useProjectStore((state) => state.updatePanelProduct);
  const updateAccessory = useProjectStore((state) => state.updateAccessory);
  const updateSteelProfile = useProjectStore((state) => state.updateSteelProfile);
  const updateSupplier = useProjectStore((state) => state.updateSupplier);
  const addCustomPanelProduct = useProjectStore((state) => state.addCustomPanelProduct);
  const deletePanelProduct = useProjectStore((state) => state.deletePanelProduct);
  const addSupplier = useProjectStore((state) => state.addSupplier);
  const deleteSupplier = useProjectStore((state) => state.deleteSupplier);
  const updateMaterialAssumptions = useProjectStore((state) => state.updateMaterialAssumptions);

  const pricedPanels = project.panelProducts.filter((panel) => panel.pricePerPanelBRL).length;
  const pricedSteelProfiles = project.steelProfiles.filter((profile) => profile.supplierPriceBRLKg).length;
  const pricedAccessories = project.accessories.filter((item) => item.unitPriceBRL).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Premissas"
        title="Catálogos e parâmetros editáveis"
        description="A primeira camada mostra prontidão de dados. Tabelas densas de catálogo, fornecedores e consumo ficam recolhidas por grupo."
        status={<StatusPill tone="warning">Fonte obrigatória</StatusPill>}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Painéis" value={project.panelProducts.length} detail={`${pricedPanels} com preço`} icon={<Boxes className="h-4 w-4" />} />
        <MetricCard label="Acessórios" value={project.accessories.length} detail={`${pricedAccessories} com preço`} icon={<Package className="h-4 w-4" />} />
        <MetricCard label="Perfis de aço" value={project.steelProfiles.length} detail={`${pricedSteelProfiles} com preço/kg`} icon={<SlidersHorizontal className="h-4 w-4" />} />
        <MetricCard label="Fornecedores" value={project.suppliers.length} detail="Base local editável" icon={<Building2 className="h-4 w-4" />} />
      </section>

      <BudgetGroupCard
        title="Próximo passo"
        description="Complete apenas os preços e fornecedores que serão usados no estudo atual. Campos sem fonte continuam pendentes no orçamento."
        status={<StatusPill tone={pricedPanels + pricedAccessories + pricedSteelProfiles > 0 ? "info" : "warning"}>{pricedPanels + pricedAccessories + pricedSteelProfiles} preço(s)</StatusPill>}
      >
        <p className="text-sm leading-6 text-muted-foreground">
          Use importação controlada ou cotação manual. Não trate preço vazio como válido e mantenha premissas técnicas revisáveis.
        </p>
      </BudgetGroupCard>

      <SectionHeader title="Configurações por grupo" description="Abra somente o grupo que precisa editar; as tabelas completas não aparecem na primeira camada." />

      <AdvancedDisclosure
        title="Catálogos, fornecedores e consumo"
        description="Editar produtos, preços, fontes locais e premissas de consumo."
        icon={WalletCards}
        badge={<StatusPill tone="neutral">5 grupos</StatusPill>}
      >
      <Tabs defaultValue="panels">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="panels">Paineis</TabsTrigger>
          <TabsTrigger value="accessories">Acessorios</TabsTrigger>
          <TabsTrigger value="steel">Aco</TabsTrigger>
          <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
          <TabsTrigger value="assumptions">Materiais</TabsTrigger>
        </TabsList>

        <TabsContent value="panels" className="mt-4">
          <Card className="rounded-md shadow-none">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Catalogo de paineis</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Itens de catalogo ficam travados nas medidas publicadas. Use painel customizado para dados recebidos de outro fornecedor.
                </p>
              </div>
              <Button onClick={addCustomPanelProduct}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar painel
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table className="min-w-[1100px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-72">Produto</TableHead>
                    <TableHead className="w-48">Fornecedor</TableHead>
                    <TableHead className="w-28">Esp.</TableHead>
                    <TableHead className="w-28">Comp.</TableHead>
                    <TableHead className="w-32">Largura util</TableHead>
                    <TableHead className="w-36">Preco painel</TableHead>
                    <TableHead className="w-28">Cor</TableHead>
                    <TableHead className="w-28">Tipo</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.panelProducts.map((panel) => (
                    <TableRow key={panel.id}>
                      <TableCell className="whitespace-normal break-words align-top">
                        <Input
                          defaultValue={panel.productName}
                          disabled={!panel.isCustom}
                          onBlur={(event) => updatePanelProduct(panel.id, { productName: event.target.value })}
                        />
                        {!panel.isCustom && panel.constraintsNote ? <p className="mt-1 text-xs text-muted-foreground">{panel.constraintsNote}</p> : null}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input defaultValue={panel.supplier} disabled={!panel.isCustom} onBlur={(event) => updatePanelProduct(panel.id, { supplier: event.target.value })} />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          defaultValue={panel.thicknessMm}
                          disabled={!panel.isCustom}
                          onBlur={(event) => updatePanelProduct(panel.id, { thicknessMm: Number(event.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={panel.lengthM}
                          disabled={!panel.isCustom}
                          onBlur={(event) => updatePanelProduct(panel.id, { lengthM: Number(event.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={panel.usefulWidthM}
                          disabled={!panel.isCustom}
                          onBlur={(event) => updatePanelProduct(panel.id, { usefulWidthM: Number(event.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={panel.pricePerPanelBRL ?? ""}
                          onBlur={(event) => updatePanelProduct(panel.id, { pricePerPanelBRL: numberOrUndefined(event.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input type="color" defaultValue={panel.colorHex} disabled={!panel.isCustom} onBlur={(event) => updatePanelProduct(panel.id, { colorHex: event.target.value })} />
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={panel.isCustom ? "secondary" : "outline"}>{panel.isCustom ? "custom" : "catalogo"}</Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <Button variant="ghost" size="icon" disabled={!panel.isCustom} onClick={() => deletePanelProduct(panel.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accessories" className="mt-4">
          <Card className="rounded-md shadow-none">
            <CardHeader>
              <CardTitle>Acessorios e precos</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Descricao</TableHead>
                    <TableHead>Un.</TableHead>
                    <TableHead>Preco</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.accessories.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.code}</TableCell>
                      <TableCell className="min-w-80">{item.description}</TableCell>
                      <TableCell>{item.defaultUnit}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={item.unitPriceBRL ?? ""}
                          onBlur={(event) => updateAccessory(item.id, { unitPriceBRL: numberOrUndefined(event.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="min-w-80 text-xs text-muted-foreground">{item.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="steel" className="mt-4">
          <Card className="rounded-md shadow-none">
            <CardHeader>
              <CardTitle>Perfis metalicos</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Familia</TableHead>
                    <TableHead>Dimensoes</TableHead>
                    <TableHead>kg/m</TableHead>
                    <TableHead>W (cm3)</TableHead>
                    <TableHead>I (cm4)</TableHead>
                    <TableHead>Preco/kg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.steelProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell>{profile.name}</TableCell>
                      <TableCell>{profile.family}</TableCell>
                      <TableCell>{profile.dimensions}</TableCell>
                      <TableCell>{profile.kgPerM}</TableCell>
                      <TableCell>{profile.sectionModulusCm3 ?? "-"}</TableCell>
                      <TableCell>{profile.inertiaIxCm4 ?? "-"}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={profile.supplierPriceBRLKg ?? ""}
                          onBlur={(event) => updateSteelProfile(profile.id, { supplierPriceBRLKg: numberOrUndefined(event.target.value) })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <Card className="rounded-md shadow-none">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Fornecedores locais</CardTitle>
              <Button onClick={addSupplier}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar fornecedor
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Produtos</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>
                        <Input defaultValue={supplier.companyName} onBlur={(event) => updateSupplier(supplier.id, { companyName: event.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input defaultValue={supplier.city} onBlur={(event) => updateSupplier(supplier.id, { city: event.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input defaultValue={supplier.state} onBlur={(event) => updateSupplier(supplier.id, { state: event.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input defaultValue={supplier.products} onBlur={(event) => updateSupplier(supplier.id, { products: event.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input defaultValue={supplier.notes} onBlur={(event) => updateSupplier(supplier.id, { notes: event.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteSupplier(supplier.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assumptions" className="mt-4">
          <Card className="rounded-md shadow-none">
            <CardHeader>
              <CardTitle>Premissas de consumo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {[
                ["wastePercent", "Perda (%)"],
                ["sparePanelCount", "Paineis reserva"],
                ["screwsPerPanel", "Parafusos costura/painel"],
                ["fixingScrewsPerPanel", "Parafusos fixacao/painel"],
                ["flashingPieceLengthM", "Comprimento acabamento (m)"],
                ["overlapLengthM", "Sobreposicao (m)"],
                ["sealantCoverageM", "Cobertura vedante (m)"],
                ["tapeCoverageM", "Cobertura fita (m)"],
              ].map(([key, label]) => (
                <div className="space-y-2" key={key}>
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={project.materialAssumptions[key as keyof typeof project.materialAssumptions]}
                    onChange={(event) => updateMaterialAssumptions({ [key]: Number(event.target.value) })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </AdvancedDisclosure>
    </PageFrame>
  );
}
