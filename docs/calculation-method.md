# Metodo de calculo

## Geometria A-frame

- largura base = `2 * comprimento do painel * cos(angulo base)`
- altura cumeeira = `comprimento do painel * sin(angulo base)`
- angulo de apice = `180 - 2 * angulo base`
- area total terreo = `largura base * profundidade efetiva`
- zona morta por lado = `altura minima util / tan(angulo base)`
- largura util terreo = `largura base - 2 * zona morta`
- area util terreo = `largura util terreo * profundidade efetiva`

Se a profundidade automatica estiver ativa, a profundidade efetiva e calculada por:

`meta de area util do terreo / largura util terreo`

## Pavimento superior / mezanino

O pavimento superior usa uma altura de piso regulavel e pode funcionar de tres modos:

- sem pavimento superior;
- segundo pavimento completo, usando 100% da profundidade disponivel;
- mezanino percentual, usando uma porcentagem da area superior disponivel.

A largura total e calculada no nivel do piso superior. A largura util considera a altura minima livre acima desse piso. No modo percentual, a profundidade equivalente e `profundidade efetiva * percentual / 100`.

## Fit no lote

O app compara largura/profundidade da casa com o lote e com a area disponivel depois dos recuos frontal, posterior e laterais.
