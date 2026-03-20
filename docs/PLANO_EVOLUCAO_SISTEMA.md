# Plano de evolução do sistema

Plano tático de execução do roadmap para ciclos curtos de entrega.

## Sumário

- [Objetivo](#objetivo)
- [Fase 1 — Segurança e consistência](#fase-1--segurança-e-consistência)
- [Fase 2 — Cobertura e confiabilidade](#fase-2--cobertura-e-confiabilidade)
- [Fase 3 — Produtividade técnica](#fase-3--produtividade-técnica)
- [Fase 4 — Maturidade contínua](#fase-4--maturidade-contínua)

## Objetivo

Traduzir o [ROADMAP.md](ROADMAP.md) em etapas verificáveis, com entrega incremental e baixo risco.

## Fase 1 — Segurança e consistência

Entregas:

1. Ajuste da estratégia de sessão para reduzir risco de exposição de token.
2. Revisão de soft delete para reduzir fallbacks de schema.
3. Revisão de validações críticas de entrada.

Critério de aceite:

- fluxo de autenticação estável;
- consultas críticas sem divergência por soft delete.

## Fase 2 — Cobertura e confiabilidade

Entregas:

1. Suítes de integração faltantes (`obras`, `diarios`, `medicoes`, `sync`).
2. Cenários negativos por perfil de acesso.
3. Verificação de contratos de resposta em endpoints críticos.

Critério de aceite:

- domínios principais cobertos por integração.

## Fase 3 — Produtividade técnica

Entregas:

1. Publicação de contrato OpenAPI.
2. Padronização de documentação operacional.
3. Evolução das exportações gerenciais (incluindo PDF quando disponível).

Critério de aceite:

- onboarding técnico simplificado e redução de dúvidas sobre contrato da API.

## Fase 4 — Maturidade contínua

Entregas:

1. Pipeline CI com lint e testes em PR.
2. Definição de metas mínimas de qualidade.
3. Rotina de revisão periódica de roadmap e testes.

Critério de aceite:

- redução de regressões e ganho de previsibilidade de entrega.

Referências:

- [ROADMAP.md](ROADMAP.md)
- [RELATORIO_TESTES.md](RELATORIO_TESTES.md)
