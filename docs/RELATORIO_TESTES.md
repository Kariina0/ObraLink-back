# Relatório de testes

**Data de execução:** 15/03/2026  
**Comando:** `npm test -- --runInBand`  
**Ambiente:** backend local (SQLite em memória de teste)

---

## Resultado geral

| Métrica | Valor |
|---------|-------|
| Test Suites | ✅ 7 passando / 7 total |
| Tests | ✅ 98 passando / 98 total |
| Snapshots | 0 |
| Tempo total | ~25,9 s |

---

## Suítes executadas

| Arquivo | Tipo | Cobertura funcional |
|---------|------|---------------------|
| `tests/integration/auth.routes.test.js` | Integração | Login, refresh, logout, me, senha |
| `tests/integration/files.routes.test.js` | Integração | Upload, acesso autenticado de arquivo |
| `tests/integration/general.routes.test.js` | Integração | Health check, stats, rotas gerais |
| `tests/integration/seed_sqlite.test.js` | Integração | Setup e seed do banco de teste |
| `tests/integration/solicitacoes.routes.test.js` | Integração | Fluxo de solicitações e aprovação |
| `tests/unit/ArquivoService.test.js` | Unitário | Lógica do serviço de arquivos |
| `tests/unit/StorageService.test.js` | Unitário | Armazenamento local e Supabase |

---

## Observações da execução

1. Logs de erro em cenários negativos são esperados (credenciais inválidas, token expirado, etc.).
2. Warnings do Knex sobre `createTableIfNotExists` — presente em migrations antigas, não impacta funcionalidade.
3. Nenhuma suíte ou teste falhou na execução atual.

---

## Lacunas de cobertura identificadas

| Domínio | Situação |
|---------|----------|
| `obras` | Sem testes de integração (CRUD, vínculos) |
| `diarios` | Sem testes de integração |
| `medicoes` | Sem testes de integração (aprovação, edição) |
| `management` | Sem testes de integração (exportações CSV) |
| `sync` | Sem testes de cenários de conflito |

---

## Recomendações de evolução

1. Adicionar `tests/integration/obras.routes.test.js` cobrindo CRUD e vínculos.
2. Adicionar `tests/integration/diarios.routes.test.js` cobrindo criação e acesso por perfil.
3. Adicionar `tests/integration/medicoes.routes.test.js` cobrindo aprovação, rejeição e cálculo geométrico.
4. Adicionar `tests/integration/sync.routes.test.js` com cenários de conflito `Last-Write-Wins`.
5. Integrar execução de testes em pipeline CI com bloqueio de merge em falha.
6. Configurar meta mínima de cobertura (`--coverage --coverageThreshold`).