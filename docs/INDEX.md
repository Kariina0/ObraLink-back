# Documentação técnica — ObraLink Backend

Documentação oficial do backend do ObraLink (Node.js + Express + Supabase/PostgreSQL).

## Sumário

- [Visão geral](#visão-geral)
- [Trilha de leitura recomendada](#trilha-de-leitura-recomendada)
- [Documentos por objetivo](#documentos-por-objetivo)
- [Documentos sugeridos para próxima iteração](#documentos-sugeridos-para-próxima-iteração)

## Visão geral

Esta pasta centraliza:

- arquitetura e organização do código;
- regras de negócio implementadas;
- setup local e comandos operacionais;
- governança de contribuição e evolução do sistema;
- relatórios técnicos e de testes.

## Trilha de leitura recomendada

| Ordem | Documento | Objetivo |
|---|---|---|
| 1 | [README.md](README.md) | Entender escopo, arquitetura, módulos e endpoints principais |
| 2 | [INSTALL.md](INSTALL.md) | Subir ambiente local de forma reprodutível |
| 3 | [COMMANDS.md](COMMANDS.md) | Operar o projeto no dia a dia |
| 4 | [STRUCTURE.md](STRUCTURE.md) | Navegar pelas camadas e responsabilidades do código |
| 5 | [REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md) | Consultar regras funcionais por domínio |
| 6 | [CONTRIBUTING.md](CONTRIBUTING.md) | Contribuir com padrão técnico do time |
| 7 | [ROADMAP.md](ROADMAP.md) | Ver direção estratégica de evolução |
| 8 | [PLANO_EVOLUCAO_SISTEMA.md](PLANO_EVOLUCAO_SISTEMA.md) | Ver plano tático de execução por fases |
| 9 | [RELATORIO_ANALISE_27022026.md](RELATORIO_ANALISE_27022026.md) | Revisão técnica consolidada |
| 10 | [RELATORIO_TESTES.md](RELATORIO_TESTES.md) | Estado atual de testes e lacunas |

## Documentos por objetivo

### Onboarding e operação

- [README.md](README.md)
- [INSTALL.md](INSTALL.md)
- [COMMANDS.md](COMMANDS.md)

### Arquitetura e implementação

- [STRUCTURE.md](STRUCTURE.md)
- [REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md)

### Governança e colaboração

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [LICENSE.md](LICENSE.md)

### Evolução e qualidade

- [ROADMAP.md](ROADMAP.md)
- [PLANO_EVOLUCAO_SISTEMA.md](PLANO_EVOLUCAO_SISTEMA.md)
- [RELATORIO_ANALISE_27022026.md](RELATORIO_ANALISE_27022026.md)
- [RELATORIO_TESTES.md](RELATORIO_TESTES.md)

## Documentos sugeridos para próxima iteração

Para elevar o nível de maturidade da documentação, recomenda-se criar:

1. `API_CONTRACT.md` — contrato de API por endpoint (request/response, códigos e exemplos).
2. `SECURITY.md` — decisões de segurança, hardening e checklist de produção.
3. `RUNBOOK.md` — procedimentos operacionais (incidente, recuperação e manutenção).
4. `CHANGELOG.md` — histórico de mudanças por release.

> Enquanto esses documentos não existem, as referências oficiais permanecem nesta pasta.
