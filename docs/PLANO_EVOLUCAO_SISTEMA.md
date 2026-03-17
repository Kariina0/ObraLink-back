# Plano de evolução do sistema — ObraLink

> Atualização técnica: 17/03/2026

---

## 1. Diagnóstico de aderência ao problema

### Problema original

Comunicação lenta e não padronizada entre escritório técnico e canteiro de obras.

### Como o sistema responde hoje

- Canal único de API para medições, diário, solicitações e arquivos
- Validação estruturada de dados de entrada (Joi)
- Fluxo de aprovação por `supervisor`/`admin` para medições e solicitações
- Sincronização em cenários de baixa conectividade (fila local no frontend + endpoints `/api/sync/*`)

### Nível de atendimento atual

| Objetivo | Situação |
|----------|----------|
| Envio ágil de medições | ✅ Atendido |
| Envio ágil de fotos/arquivos | ✅ Atendido |
| Diário de obra estruturado | ✅ Atendido |
| Solicitações de compra com fluxo | ✅ Atendido |
| Funcionamento com baixa conectividade | ⚠️ Atendido com limitações operacionais |
| Segurança/LGPD | ⚠️ Atendido parcialmente |

---

## 2. Restrições e riscos identificados

| # | Risco | Impacto | Status |
|---|-------|---------|--------|
| R1 | Tokens JWT em `localStorage` no frontend | XSS pode comprometer sessão | ⚠️ Pendente |
| R2 | Soft delete híbrido (coluna + metadata JSON) | Inconsistência em queries | ⚠️ Pendente |
| R3 | Exportação PDF indisponível (`501`) | Relatório operacional ausente | ⚠️ Pendente |
| R4 | Cobertura de testes incompleta | Regressões não detectadas | ⚠️ Pendente |

---

## 3. Plano de evolução faseado

### Fase A — Estabilidade e segurança (curto prazo)

| Item | Ação | Prioridade |
|------|------|------------|
| Segurança de sessão | Migrar tokens para cookies `httpOnly` (backend + frontend) | Alta |
| Soft delete | Padronizar `deletedAt` como coluna em todas as entidades críticas | Alta |
| Sync observability | Consolidar tratamento de conflitos com indicadores por obra | Média |

**Critério de sucesso:**
- 0 uso de token em `localStorage`
- 100% das consultas críticas sem dependência de `metadata` para soft delete

---

### Fase B — Produtividade do escritório (médio prazo)

| Item | Ação | Prioridade |
|------|------|------------|
| PDF de boletim | Implementar `/api/management/exports/boletim.pdf` | Média |
| OpenAPI | Publicar especificação com `swagger-jsdoc` + `swagger-ui-express` | Média |
| Dashboard de sync | Endpoint `/api/sync/stats` + tela de integridade no frontend | Baixa |

**Critério de sucesso:**
- PDF de boletim disponível para uso operacional
- API documentada e consumível por terceiros sem reverse engineering

---

### Fase C — Governança e escala (médio/longo prazo)

| Item | Ação | Prioridade |
|------|------|------------|
| Cobertura de testes | Testes de integração para `obras`, `diarios`, `sync` | Alta |
| LGPD | Política formal de retenção e anonimização de dados | Média |
| CI pipeline | GitHub Actions: lint + testes + bloqueio de merge em falha | Média |
| PostgreSQL | Migrar para PostgreSQL em produção (driver `pg` já configurado) | Baixa |

**Critério de sucesso:**
- Cobertura de integração em todos os domínios de negócio
- Checklist LGPD operacional documentado e adotado

---

## 4. Diretrizes de execução

Todas as evoluções devem respeitar os princípios fundadores do projeto:

- **Acessibilidade:** facilidade de uso para perfis de baixa maturidade digital
- **Resiliência:** operação plena em conectividade instável
- **Baixo custo:** sem dependência de novos equipamentos ou infraestrutura cara
- **Integração real:** funcionalidades alinhadas com a rotina de obra
- **Segurança:** proteção de dados e conformidade com LGPD

---

## 5. Roadmap de implementação resumido

### Fase 1 — Estabilização (prioridade imediata)

| Ordem | Item | Complexidade |
|-------|------|-------------|
| 1 | Migrar tokens para cookies `httpOnly` | Alta |
| 2 | Padronizar soft delete (coluna `deletedAt`) | Média |
| 3 | Proteger uploads em produção (rota autenticada) | Média |

### Fase 2 — Produtividade

| Ordem | Item | Complexidade |
|-------|------|-------------|
| 4 | Implementar exportação PDF de boletim | Alta |
| 5 | Publicar especificação OpenAPI | Média |
| 6 | Pipeline CI (lint + testes) | Baixa |

### Fase 3 — Escala e governança

| Ordem | Item | Complexidade |
|-------|------|-------------|
| 7 | Ampliar cobertura de testes | Média |
| 8 | Migrar para PostgreSQL em produção | Média |
| 9 | Política LGPD formal | Média |
| 15 | Adicionar testes automatizados frontend | ME-06 | Alta |

### Fase 4 — Evolução e Valor Agregado

Novas funcionalidades que ampliam o impacto da solução.

| Ordem | Item | Ref. | Complexidade |
|-------|------|------|-------------|
| 16 | Implementar notificações | EF-02 | Alta |
| 17 | Implementar exportação PDF | EF-03 | Média |
| 18 | Dashboard visual com gráficos | EF-06 | Média |
| 19 | Modo câmera direta e geolocalização | EF-07 | Média |
| 20 | Fluxo completo de compras | EF-08 | Alta |

### Fase 5 — Refinamento

Ajustes de qualidade e dívida técnica.

| Ordem | Item | Ref. | Complexidade |
|-------|------|------|-------------|
| 21 | Refatorar inline styles para classes CSS | ME-05 | Média |

---

## 7 — Status das Melhorias

| # | Melhoria | Ref. | Status | Arquivos Afetados | Observações |
|---|---------|------|--------|-------------------|-------------|
| 1 | Corrigir porta da API | CC-01 | CONCLUÍDO | `frontend/.env`, `frontend/src/services/api.js` | Backend usa `PORT=5000`. Frontend `.env` corrigido de `5001` para `5000`. Fallback em `api.js` também corrigido de `5001` para `5000`. `api-examples.http` já estava correto. |
| 2 | Atualizar manifest.json e index.html | CC-05 | CONCLUÍDO | `frontend/public/manifest.json`, `frontend/public/index.html` | `description` adicionado ao manifest; `start_url` corrigido de `"."` para `"/"`; `theme-color` alinhado para `#1e3a5f`; `meta description` substituída; mensagem `noscript` traduzida para português. |
| 3 | Atualizar README do frontend | ME-08 | CONCLUÍDO | `frontend/README.md` | Referência a MongoDB removida; stack corrigida para SQLite/Knex; estrutura de pastas, funcionalidades (14 telas), pré-requisitos e instruções de setup reescritos com informações reais. |
| 4 | Rate limiting no login | CC-04 | CONCLUÍDO | `src/routes/auth.js` | `loginLimiter` dedicado: 10 tentativas/15min por IP, `skipSuccessfulRequests: true`. Limiters adicionais para `/refresh`, `/forgot-password` e `/reset-password`. Configurável via env vars. |
| 5 | Proteger uploads em produção | CC-02 | CONCLUÍDO | `src/app.js`, `src/routes/files.js`, `src/services/ArquivoService.js`, `src/services/StorageService.js` | `express.static` público removido de `app.js`; rota autenticada `GET /api/files/raw/:tipo/:filename` adicionada em `files.js` com proteção contra path traversal; URLs locais corrigidas de `/uploads/` para `/api/files/raw/` em `ArquivoService` (2 pontos) e `StorageService` (2 pontos). |
| 6 | Corrigir soft delete de obras | CC-03 | CONCLUÍDO | `src/services/ObraService.js` | `BaseRepository.update()` chama `findById()` internamente após gravar o soft delete; `findById()` aplica `_applyNotDeleted()` e lança `NotFoundError` porque o registro já está filtrado como deletado. O erro propagava até o controller retornando 404 ao cliente (falso erro). Corrigido com try/catch em `ObraService.delete()` que captura o `NotFoundError` esperado e retorna sucesso. `findAll`, `findById` e `findByEncarregado` já aplicavam o filtro corretamente. |
| 7 | Remover tabelas/código legado | ME-07 | CONCLUÍDO | `migrations/20260310_remove_legacy_tables.js`, `frontend/src/services/medicoesService.js` | Nova migration criada e aplicada: tabelas `measurements` e `purchases` removidas do banco (confirmado via `knex migrate:status`). Função `listMedicoesByObra()` removida de `medicoesService.js` — era código morto (não importada em nenhuma tela). |
| 8 | Diário de Obra (RDO) | EF-01 | CONCLUÍDO | Backend: `src/routes/diarios.js`, `src/controllers/DiarioController.js`, `src/services/DiarioService.js`, `src/validators/diarioValidator.js`, `src/dtos/DiarioDTO.js`, `src/routes/index.js`. Frontend: já estava implementado (`frontend/src/pages/DiarioObra.jsx`, `frontend/src/services/diariosService.js`, rota `/diario` e permissões). | Módulo completo criado no backend seguindo padrão Route→Controller→Service→Repository. Endpoints: `POST /api/diarios`, `GET /api/diarios/minhas`, `GET /api/diarios`, `GET /api/diarios/:id`, `PUT /api/diarios/:id`, `DELETE /api/diarios/:id`. Validação Joi com campos: obra, data, clima, atividades (obrigatório), equipamentos, maoDeObra, materiais, ocorrencias, visitantes, fotos, observacoesGerais. Controle de acesso: encarregado só acessa obras vinculadas. App testado e carregado sem erros. |
| 9 | Tela de reset de senha | EF-04 | CONCLUÍDO | `frontend/src/pages/Login.jsx`, `frontend/src/services/authRecoveryService.js` | Fluxo completo já implementado na `Login.jsx`: botão "Esqueci minha senha" aciona o `forgotMode` com 3 passos (email → código → nova senha). `authRecoveryService.js` com `requestPasswordReset()` e `resetPasswordWithCode()` já existia. Hint de código visível em desenvolvimento. Nenhum arquivo adicional necessário. |
| 10 | PWA com Service Worker | ME-01 | PENDENTE | `frontend/public/`, `frontend/src/index.js` | Instalação no celular |
| 11 | Sincronização offline completa | ME-03 | PENDENTE | `frontend/src/utils/db.js`, `frontend/src/services/syncService.js` (novo) | Medições e solicitações offline |
| 12 | Migrar para PostgreSQL | ME-02 | PENDENTE | `knexfile.js`, `.env` | Configuração já prevista |
| 13 | Tokens em httpOnly cookies | ME-04 | PENDENTE | `src/config/jwt.js`, `src/routes/auth.js`, `src/middleware/auth.js`, `frontend/src/services/api.js`, `frontend/src/context/AuthContext.js` | Mitigar risco XSS |
| 14 | Conformidade LGPD | EF-05 | PENDENTE | `frontend/src/pages/TermosUso.jsx` (novo), `frontend/src/pages/Register.jsx`, `src/routes/auth.js` | Termos de uso + exclusão de dados |
| 15 | Testes frontend | ME-06 | PENDENTE | `frontend/src/__tests__/` (novo) | Services, utils, fluxos principais |
| 16 | Notificações | EF-02 | PENDENTE | `src/services/NotificacaoService.js` (novo), `frontend/src/components/NotificationBadge.jsx` (novo) | In-app + e-mail |
| 17 | Exportação PDF | EF-03 | PENDENTE | `src/services/RelatorioService.js` (novo), `frontend/src/pages/MeusRelatorios.jsx` | pdfkit ou puppeteer |
| 18 | Dashboard com gráficos | EF-06 | PENDENTE | `frontend/src/pages/AdminPanel.jsx`, `frontend/src/pages/Dashboard.jsx` | recharts ou chart.js |
| 19 | Câmera direta + GPS | EF-07 | PENDENTE | `frontend/src/pages/EnviarMedicao.jsx`, `frontend/src/pages/Upload.jsx` | Campo `coordenadas` já existe no schema |
| 20 | Fluxo completo de compras | EF-08 | PENDENTE | `src/repositories/SolicitacaoCompraRepository.js`, `frontend/src/pages/StatusSolicitacao.jsx` | Cotação → pedido → entrega |
| 21 | Refatorar inline styles | ME-05 | PENDENTE | `frontend/src/pages/*.jsx`, `frontend/src/styles/pages.css` | Qualidade de código |

---

## 8 — Instruções para Futuras Implementações

### Antes de implementar qualquer melhoria

1. **Ler este documento por completo** — entender a arquitetura, os problemas identificados e o plano de evolução.

2. **Verificar o status das melhorias** na tabela da seção 7 — não reimplementar algo já concluído e verificar se há dependências entre itens.

3. **Seguir o roadmap da seção 6** — respeitar a ordem de prioridade definida. As fases são sequenciais: não avançar para a Fase 3 sem que os itens críticos da Fase 1 estejam resolvidos.

4. **Não alterar funcionalidades existentes sem necessidade** — cada melhoria deve ser cirúrgica, afetando apenas os arquivos listados. Não refatorar código adjacente que esteja funcionando.

5. **Preservar a arquitetura em camadas do backend** — novas funcionalidades devem seguir o padrão `Route → Controller → Service → Repository`. Não colocar lógica de negócio nos controllers ou nas rotas.

6. **Preservar o padrão de validação** — toda entrada de dados deve ser validada com Joi no backend e com validação visual no frontend. Manter o espelhamento front/back.

7. **Preservar o controle de acesso** — novas rotas devem usar `authenticate` + `authorize(...)`. Novas telas devem ter entrada em `ROUTE_PERMISSIONS` e serem envolvidas por `PrivateRoute`.

8. **Testar a integração front ↔ back** — após implementar, verificar se os endpoints são consumidos corretamente, se os dados trafegam no formato esperado, e se erros são tratados.

9. **Atualizar este documento** — após concluir uma melhoria, alterar o status na tabela da seção 7 para `CONCLUÍDO` e registrar observações relevantes.

### Convenções de código

- **Backend:** CommonJS (`require`/`module.exports`), classes para Services, Knex para queries
- **Frontend:** ESM (`import`/`export`), componentes funcionais com hooks, Axios para API
- **Validação:** Joi (backend), validações manuais + HTML5 (frontend)
- **Estilo:** CSS com variáveis customizadas (`--cor-*`, `--espacamento-*`, `--tamanho-fonte-*`)
- **Nomes de arquivo:** PascalCase para componentes React, camelCase para services/utils, snake_case para migrations

### Estrutura de diretórios para novos módulos

```
Backend (novo módulo "diarios" como exemplo):
  src/routes/diarios.js          → endpoints HTTP
  src/controllers/DiarioController.js → orquestração de request/response
  src/services/DiarioService.js   → regras de negócio
  src/repositories/DiarioRepository.js → já existe
  src/validators/diarioValidator.js → schema Joi
  src/dtos/DiarioDTO.js           → serialização de saída

Frontend (novo módulo "diarios" como exemplo):
  src/pages/DiarioObra.jsx        → tela principal
  src/services/diariosService.js  → chamadas API
  src/constants/diario.js         → constantes (tipos, status)
```
