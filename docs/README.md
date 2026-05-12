# Documentação Do Projeto

Este diretório documenta o Estudo Construtivo: uma experiência guiada para pré-orçamento modular a partir de planta baixa, medidas manuais ou exemplo.

## Experiência E Produto

- `product-experience.md`: direção do produto, regra central de fluxo e limites da IA.
- `onboarding-ux.md`: contrato do assistente `/start` e da revisão guiada.
- `setup-ai-and-sinapi.md`: setup operacional de `.env.local`, Vercel, OpenAI API, limites e SINAPI.
- `free-cloud-ai-routing.md`: política do modo free-cloud, providers gratuitos por tarefa e OpenAI em standby.
- `sinapi-integration.md`: importação controlada de base SINAPI e regras de status.
- `pricing-database-architecture.md`: decisão arquitetural para base externa de preços, Supabase Free, sync mensal e proteção do plano Vercel Hobby.
- `pricing-database-schema.md`: schema/RLS da base externa de preços e contrato de leitura pública segura.

## Contratos Técnicos

- `AI_PLAN_EXTRACT.md`: configuração, custo, limites e privacidade da extração de planta baixa com o runtime atual.
- `budget-assistant.md`: contrato técnico do Assistente de orçamento para fontes, matches, composições, revisão humana, cache e limites.
- `lucas-design-authority-protocol.md`: autoridade de revisão visual/produto e regra de comentários `Lucas Review`.
- `slack-github-review-bridge.md`: setup do `/lucas-review` no Slack para comentar em PRs do GitHub.
- `slack-hourly-triage.md`: automação agendada GitHub Actions -> Slack para resumo de issues/PRs.
- `design-stack-critical-review.md`: avaliação crítica objetiva da stack de design `#135–#144`.
- `calculation-method.md`: fórmulas principais, incluindo a baseline A-frame.
- `structural-assumptions.md`: premissas e limites estruturais.
- `material-assumptions.md`: materiais e quantidades.
- `export-format.md`: formatos gerados.
- `limitations.md`: limites técnicos e legais.
- `privacy-auth.md`: login, dados pessoais mínimos e privacidade.
- `quotation-workflow.md`: fluxo para atualizar preços por cotação.

O app deve ser usado como assistente de estudo e pré-orçamento. Orçamento final, projeto executivo, ART/RRT, aprovação municipal e validação técnica continuam fora do escopo.
