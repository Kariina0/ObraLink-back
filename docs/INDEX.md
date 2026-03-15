# Índice da documentação técnica

Documentação oficial do sistema de comunicação ágil entre escritório e canteiro da Construtora RPG.

Atualizado com base no código-fonte em **15/03/2026**.

## Leitura recomendada

1. [README.md](README.md) — visão geral funcional e arquitetural
2. [STRUCTURE.md](STRUCTURE.md) — estrutura real de backend e frontend
3. [INSTALL.md](INSTALL.md) — instalação e execução local
4. [COMMANDS.md](COMMANDS.md) — comandos operacionais
5. [REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md) — regras de negócio implementadas

## Documentos por tema

### Base técnica

- [README.md](README.md)
- [STRUCTURE.md](STRUCTURE.md)
- [INSTALL.md](INSTALL.md)
- [COMMANDS.md](COMMANDS.md)
- [REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md)

### Governança e evolução

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [ROADMAP.md](ROADMAP.md)
- [PLANO_EVOLUCAO_SISTEMA.md](PLANO_EVOLUCAO_SISTEMA.md)

### Auditoria e qualidade

- [RELATORIO_ANALISE_27022026.md](RELATORIO_ANALISE_27022026.md)
- [RELATORIO_TESTES.md](RELATORIO_TESTES.md)

### Legal

- [LICENSE.md](LICENSE.md)

## Escopo desta documentação

- Banco de dados real: **SQLite + Knex migrations**
- API real: **Express + JWT + Joi + RBAC**
- Upload: **Local ou Supabase (configurável)**
- Sincronização: **fila offline no frontend + endpoints `/api/sync/*` no backend**
- Frontend analisado em pasta irmã: `../frontend`

## Importante

Esta pasta foi revisada para remover referências desatualizadas (ex.: MongoDB como banco principal, rotas antigas e funcionalidades não implementadas) e refletir **somente o que existe no código atual**.
