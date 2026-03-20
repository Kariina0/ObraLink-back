# Relatório de testes

Visão consolidada dos testes do backend e próximos passos de cobertura.

## Sumário

- [Objetivo](#objetivo)
- [Situação atual](#situação-atual)
- [Escopo existente](#escopo-existente)
- [Lacunas prioritárias](#lacunas-prioritárias)
- [Comandos recomendados](#comandos-recomendados)

## Objetivo

Garantir confiabilidade de fluxos críticos e reduzir regressões em evolução contínua.

## Situação atual

A base possui testes automatizados com Jest (integração e unitário), com cobertura já estabelecida em autenticação, arquivos e partes de solicitações/serviços.

## Escopo existente

| Área | Cobertura |
|---|---|
| Auth | Presente |
| Files | Presente |
| Rotas gerais | Presente |
| Solicitações | Presente |
| Serviços de storage | Presente |

## Lacunas prioritárias

| Domínio | Ação recomendada |
|---|---|
| Obras | suíte de integração para CRUD e vínculos |
| Diários | suíte por perfil e regras de data/duplicidade |
| Medições | suíte de aprovação/rejeição e cenários de status |
| Sync | suíte com conflitos e retry |
| Management | suíte de filtros e exportações CSV |

## Comandos recomendados

Execução base:

```bash
npm test -- --runInBand
```

Com cobertura:

```bash
npm test -- --coverage --runInBand
```

Suíte específica:

```bash
npm test -- tests/integration/auth.routes.test.js --runInBand
```

Referências:

- [COMMANDS.md](COMMANDS.md)
- [ROADMAP.md](ROADMAP.md)
- [PLANO_EVOLUCAO_SISTEMA.md](PLANO_EVOLUCAO_SISTEMA.md)
