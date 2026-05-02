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

## Radier com fibras

O orcamento de fundacao calcula um radier preliminar usando a projecao da casa mais uma folga perimetral editavel.

- area do radier = `(largura da casa + 2 * folga) * (profundidade + 2 * folga)`
- concreto da placa = `area * espessura da placa`
- concreto da viga de borda = `perimetro * largura da viga * altura da viga`
- concreto total = `(placa + viga de borda) * (1 + perda%)`
- fibra = `concreto total * dosagem kg/m3`
- sub-base = `area * espessura da sub-base`

Os precos de concreto, fibra, sub-base, forma, lona, mao de obra e bomba sao parametros editaveis.

Os valores seed de concreto e sub-base usam referencias publicas SINAPI Bahia 03/2026:

- concreto/concretagem C25: https://buscadorsinapi.com.br/ba/composicao/103684-concretagem-de-reservatorios-fck-25-mpa-com-uso-de-bomba-lan
- preparo com camada de brita: https://buscadorsinapi.com.br/composicao/101623
