# A-frame MVP

Aplicacao local para estudo preliminar de casa A-frame com paineis sanduiche Kingspan Isoeste / KingRoofing.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## O que o MVP faz

- calcula geometria A-frame, areas totais, areas uteis, zonas mortas e fit no lote;
- mostra modelo 3D interativo com terreno, recuos, paineis, estrutura interna, tercas e pavimento superior/mezanino opcional;
- recalcula lista de materiais com seed real Kingspan/KingRoofing;
- trava produtos de catalogo em opcoes compraveis e deixa medidas livres apenas no painel customizado;
- separa pacote de paineis, frete, aco, civil, mao de obra, tecnico/legal e contingencia;
- usa fontes de preco de aco como referencia preliminar, com cotacao formal ainda obrigatoria;
- gera cenarios, pedidos de cotacao, JSON, PDF, XLSX e CSV;
- salva no LocalStorage e permite importar/exportar JSON.

## Editar catalogos

- Paineis: `Premissas > Paineis`
- Acessorios: `Premissas > Acessorios`
- Perfis de aco: `Premissas > Aco`
- Fornecedores: `Premissas > Fornecedores`
- Premissas de consumo: `Premissas > Materiais`

Os dados seed ficam em `src/data`. Use a interface para alterar valores no navegador; exporte JSON para guardar o projeto.

## Exportar

Use a pagina `Exportar` para baixar:

- projeto JSON;
- lista de materiais XLSX;
- lista de materiais CSV;
- relatorio PDF;
- projeto tecnico PDF preliminar;
- pedidos de cotacao TXT.

## Limitacoes

Esta ferramenta e somente uma estimativa preliminar para estudo de viabilidade. Nao substitui projeto estrutural, projeto arquitetonico, ART/RRT, aprovacao municipal, sondagem de solo, calculo de fundacoes, verificacao de vento, ligacoes metalicas ou validacao tecnica do fornecedor dos paineis.

## Validacao

```bash
npm run lint
npm run test
npm run build
```
