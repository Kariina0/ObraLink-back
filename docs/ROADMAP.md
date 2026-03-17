# Roadmap técnico

> Baseado no estado da branch `feature/implementacao-melhorias` em 17/03/2026.

---

## Concluído

| Item | Detalhes |
|------|----------|
| Autenticação JWT | Access token (15 min) + refresh token (7 dias) com rotação |
| RBAC | Perfis `admin`, `supervisor`, `encarregado` por rota |
| CRUD de obras | Com vínculo N:N obra ↔ encarregado |
| Medições | Criação, edição, aprovação/rejeição e cálculo geométrico |
| Diário de obra | Registro estruturado com validação de campos |
| Solicitações de compra | Fluxo completo com valor calculado e aprovação |
| Upload de arquivos | Compressão, validação por magic bytes, storage local/Supabase |
| Sincronização | Endpoints `/api/sync/*` e fila offline no frontend (IndexedDB) |
| Painel gerencial | Dashboard consolidado + exportações CSV |
| Recuperação de senha | Por código numérico de 6 dígitos com TTL |
| Testes automatizados | 7 suítes, 98 testes (integração + unitários) |

---

## Prioridade alta

### 1) Segurança de sessão — migrar para cookies `httpOnly`

**Problema:** tokens JWT armazenados em `localStorage` são acessíveis via JavaScript, vulneráveis a ataques XSS.

**Ação:**
- Configurar o backend para emitir cookies `httpOnly; Secure; SameSite=Strict`
- Remover leitura de token do `localStorage` no frontend (`AuthContext.js`)
- Atualizar o interceptor do Axios para não enviar `Authorization` header manualmente

---

### 2) Padronizar soft delete

**Problema:** exclusão lógica usa `deletedAt` como coluna em algumas entidades e como campo dentro de `metadata` JSON em outras, tornando as queries inconsistentes.

**Ação:**
- Auditar todas as entidades e unificar como coluna `deletedAt` em todas
- Adicionar migration de normalização para `medicoes`
- Rever queries nos repositories que filtram por `metadata`

---

### 3) Ampliar cobertura de testes

**Problema:** testes concentrados em `auth`, `files`, `solicitacoes` e serviços de storage. Fluxos de `obras`, `diarios` e `sync` sem cobertura automatizada.

**Ação:**
- Adicionar `tests/integration/obras.routes.test.js`
- Adicionar `tests/integration/diarios.routes.test.js`
- Adicionar `tests/integration/sync.routes.test.js` com cenários de conflito
- Meta: cobertura de integração em todos os domínios de negócio

---

## Prioridade média

### 4) Exportação PDF de boletim

**Problema:** `/api/management/exports/boletim.pdf` retorna `501 Not Implemented`.

**Ação:**
- Implementar com `pdfkit` ou `puppeteer`
- Incluir medições aprovadas, fotos vinculadas e assinatura de responsável

---

### 5) Especificação OpenAPI

**Problema:** sem contrato formal da API, o frontend e terceiros dependem de reverse engineering ou documentação manual.

**Ação:**
- Adicionar `swagger-jsdoc` + `swagger-ui-express`
- Documentar todos os endpoints com exemplos reais de payload

---

### 6) Observabilidade de sincronização

**Problema:** não há métricas de sucesso/conflito/erro por tipo de entidade ou por obra.

**Ação:**
- Adicionar tabela ou log estruturado de eventos de sync
- Expor endpoint `/api/sync/stats` para o dashboard de integridade

---

## Prioridade evolutiva

### 7) UX offline aprimorado

- Tela de reprocessamento manual por item na fila (`Sincronizacao.jsx`)
- Indicador visual de estado por item: pendente / enviado / conflito / erro

### 8) Governança LGPD

- Política formal de retenção e anonimização de dados sensíveis
- Endpoint de exportação de dados do usuário (portabilidade)
- Endpoint de exclusão de conta com anonimização

### 9) Pipeline CI

- GitHub Actions com: lint → testes → bloqueio de merge em falha
- Badge de status no README

### 10) PostgreSQL em produção

- Migrar do SQLite para PostgreSQL no ambiente de produção
- `knexfile.js` já suporta o driver `pg`; basta configurar `DATABASE_URL`