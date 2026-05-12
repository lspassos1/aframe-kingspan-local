# Onboarding UX

`/start` deve ser um assistente guiado. A tela inicial precisa ser curta, acionável e centrada na planta baixa ou nas medidas, não no método construtivo.

## Primeira Camada

Mostrar somente:

- título curto;
- subtítulo curto;
- três opções claras.

Copy recomendada:

> Comece seu estudo pela planta baixa. Envie uma planta, preencha medidas simples ou use um exemplo. Você revisa tudo antes de gerar orçamento e 3D.

Cards iniciais:

- Enviar planta baixa
- Preencher manualmente
- Usar exemplo

Não mostrar na primeira camada:

- cards de método;
- formulário técnico completo;
- alertas técnicos longos;
- limitações de método;
- termos internos como nome de módulo, siglas de produto ou placeholder.

## Modo IA

Quando `AI_PLAN_EXTRACT_ENABLED=true` e o provider do modo atual estiver configurado, upload de planta deve ser o caminho principal. Em `AI_MODE=free-cloud`, isso significa Gemini como leitura principal; em `AI_MODE=paid`, OpenAI explícito.

Estados obrigatórios:

- idle;
- uploading;
- analyzing;
- cache hit;
- review ready;
- error;
- limit exceeded.

Se IA estiver desligada ou sem o provider server-side do modo atual, a UI deve explicar de forma segura que o upload assistido não está disponível e oferecer fluxo manual.

## Modo Manual

O modo manual coleta dados mínimos para começar:

- nome do projeto;
- cidade/UF;
- dimensões principais;
- dados necessários para o método escolhido depois.

Campos obrigatórios devem aparecer com erro claro e acessível.

## Modo Exemplo

O exemplo deve abrir um estudo utilizável rapidamente. Ele não deve depender de IA nem de base SINAPI importada.

## Etapa De Método

O método construtivo aparece depois da escolha do modo ou depois da revisão da planta.

Cards de método devem mostrar:

- nome;
- uma frase curta;
- até 2 chips;
- estado ativo claro;
- detalhes técnicos sob demanda.

## Revisão Humana

Dados extraídos por IA devem aparecer antes/depois e permitir seleção parcial. Dados de baixa confiança ficam desmarcados por padrão.

Método incerto é sugestão, não ação automática.
