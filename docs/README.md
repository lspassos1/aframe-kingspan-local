# Documentação Do Projeto

Este diretório documenta o Estudo Construtivo: uma experiência guiada para pré-orçamento modular a partir de planta baixa, medidas manuais ou exemplo.

## Experiência E Produto

- `product-experience.md`: direção do produto, regra central de fluxo e limites da IA.
- `onboarding-ux.md`: contrato do assistente `/start` e da revisão guiada.
- `setup-ai-and-sinapi.md`: setup operacional de `.env.local`, Vercel, OpenAI API, limites e SINAPI.
- `sinapi-integration.md`: importação controlada de base SINAPI e regras de status.

## Contratos Técnicos

- `AI_PLAN_EXTRACT.md`: configuração, custo, limites e privacidade da extração de planta baixa com OpenAI API.
- `budget-assistant.md`: contrato técnico para fontes, matches, composições, revisão humana, cache e limites do orçamento assistido.
- `calculation-method.md`: fórmulas principais, incluindo a baseline A-frame.
- `structural-assumptions.md`: premissas e limites estruturais.
- `material-assumptions.md`: materiais e quantidades.
- `export-format.md`: formatos gerados.
- `limitations.md`: limites técnicos e legais.
- `privacy-auth.md`: login, dados pessoais mínimos e privacidade.
- `quotation-workflow.md`: fluxo para atualizar preços por cotação.

O app deve ser usado como assistente de estudo e pré-orçamento. Orçamento final, projeto executivo, ART/RRT, aprovação municipal e validação técnica continuam fora do escopo.
