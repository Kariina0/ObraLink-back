# Índice da documentação — ObraLink

> Documentação técnica do sistema de comunicação ágil entre escritório e canteiro da Construtora RPG.  
> Última revisão: **17/03/2026**

---

## Leitura recomendada (ordem sugerida)

| # | Documento | Conteúdo |
|---|-----------|----------|
| 1 | [README.md](README.md) | Visão geral funcional, stack, endpoints e arquitetura |
| 2 | [STRUCTURE.md](STRUCTURE.md) | Estrutura de pastas detalhada e responsabilidade de cada camada |
| 3 | [INSTALL.md](INSTALL.md) | Instalação e execução local (backend + frontend) |
| 4 | [COMMANDS.md](COMMANDS.md) | Comandos operacionais, SQL útil e troubleshooting |
| 5 | [REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md) | Todas as regras implementadas por domínio |

---

## Documentos por tema

### Base técnica

- [README.md](README.md) — overview completo do projeto
- [STRUCTURE.md](STRUCTURE.md) — mapa de arquivos e camadas
- [INSTALL.md](INSTALL.md) — setup do ambiente
- [COMMANDS.md](COMMANDS.md) — referência de comandos
- [REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md) — contratos de domínio

### Governança e evolução

- [CONTRIBUTING.md](CONTRIBUTING.md) — fluxo de contribuição e padrões de código
- [ROADMAP.md](ROADMAP.md) — próximas melhorias priorizadas
- [PLANO_EVOLUCAO_SISTEMA.md](PLANO_EVOLUCAO_SISTEMA.md) — plano faseado de evolução

### Auditoria e qualidade

- [RELATORIO_ANALISE_27022026.md](RELATORIO_ANALISE_27022026.md) — análise técnica consolidada
- [RELATORIO_TESTES.md](RELATORIO_TESTES.md) — resultado da suíte de testes

### Legal

- [LICENSE.md](LICENSE.md) — licença MIT

---

## Escopo desta documentação

| Aspecto | Detalhe |
|---------|--------|
| Banco de dados | SQLite + Knex migrations (PostgreSQL via `pg` em produção) |
| API | Express + JWT + Joi + RBAC |
| Upload | Local ou Supabase (configurável via `STORAGE_PROVIDER`) |
| Sincronização | Fila offline no frontend (IndexedDB) + `/api/sync/*` no backend |
| Frontend | React 19, pasta irmã `../frontend` |

---

> Esta documentação reflete **somente o que existe no código atual**.  
> Referências obsoletas (MongoDB, rotas antigas) foram removidas nas revisões anteriores.
