# RELATÓRIO TÉCNICO — ANÁLISE COMPLETA DO BACK-END
**Projeto:** Canteiro de Obra — Sistema de Gestão de Construção  
**Data:** 27/02/2026  
**Analista:** GitHub Copilot (Claude Sonnet 4.6)  
**Escopo:** Análise arquitetural, testes automatizados, identificação de bugs e recomendações

---

## 1. VISÃO GERAL DA ARQUITETURA

### Stack Tecnológico

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 18+ |
| Framework HTTP | Express | 4.x |
| Banco de dados | SQLite (via Knex.js) | 3.x |
| Autenticação | JSON Web Tokens (jsonwebtoken + bcryptjs) | - |
| Armazenamento de arquivos | Local + Supabase Storage (opcional) | - |
| Validação | Joi + express-validator | - |
| Testes | Jest + Supertest | 29.x |
| Logging | Winston | - |
| Segurança | Helmet, CORS, express-rate-limit | - |

### Estrutura de Camadas

```
Requisição HTTP
    └─► Middleware Global (Helmet, CORS, Rate Limit, Morgan)
        └─► Roteamento (src/routes/)
            └─► Middleware de Autenticação (middleware/auth.js)
                └─► Middleware de Validação (middleware/validation.js)
                    └─► Controller (src/controllers/)
                        └─► Service (src/services/)
                            └─► Repository (src/repositories/)
                                └─► Knex.js → SQLite
```

### Padrões Arquiteturais Adotados

- **Repository Pattern** — acesso a dados isolado em repositórios (`BaseRepository` + repositórios especializados)
- **Service Layer** — lógica de negócio encapsulada em serviços
- **DTO Pattern** — objetos de transferência que sanitizam entrada/saída (`ArquivoDTO`, `MedicaoDTO`, `UserDTO`, `DiarioDTO`)
- **Soft Delete** — remoção lógica via campo `metadata.deletedAt` armazenado como JSON no SQLite
- **Error Hierarchy** — hierarquia de erros customizados com mapeamento automático para códigos HTTP

### Fluxo de Autenticação

```
Login → JWT Access Token (15min) + Refresh Token (7 dias)
                                        ↓
                          Hash bcrypt armazenado no banco
                                        ↓
POST /api/auth/refresh → bcrypt.compare(plain, hash) → novo Access Token
                                        ↓
POST /api/auth/logout  → refreshToken = null no banco
```

---

## 2. MAPEAMENTO COMPLETO DOS ENDPOINTS

### Autenticação (`/api/auth`)

| Método | Rota | Auth | Perfis | Status |
|---|---|---|---|---|
| POST | `/api/auth/register` | Não | — | ✅ Funcional |
| POST | `/api/auth/login` | Não | — | ✅ Funcional |
| GET | `/api/auth/me` | Sim | Todos | ✅ Funcional |
| POST | `/api/auth/logout` | Sim | Todos | ✅ Funcional |
| POST | `/api/auth/refresh` | Não | — | ✅ Funcional |
| PUT | `/api/auth/change-password` | Sim | Todos | ✅ Funcional |

### Obras (`/api/obras`)

| Método | Rota | Auth | Perfis | Status |
|---|---|---|---|---|
| GET | `/api/obras` | Sim | Todos | ✅ Funcional |
| GET | `/api/obras/:id` | Sim | Todos | ✅ Funcional |
| POST | `/api/obras` | Sim | admin/supervisor | ✅ Funcional |
| PUT | `/api/obras/:id` | Sim | admin/supervisor | ✅ Funcional |
| DELETE | `/api/obras/:id` | Sim | admin | ✅ Funcional |

### Medições (`/api/measurements`)

| Método | Rota | Auth | Perfis | Status |
|---|---|---|---|---|
| GET | `/api/measurements` | Sim | Todos | ✅ Funcional |
| GET | `/api/measurements/:id` | Sim | Todos | ✅ Funcional |
| POST | `/api/measurements` | Sim | admin/supervisor | ✅ Funcional |
| PUT | `/api/measurements/:id` | Sim | admin/supervisor | ✅ Funcional |
| DELETE | `/api/measurements/:id` | Sim | admin | ✅ Funcional |

### Rota Legada de Medições (`/api/medicoes`)

| Método | Rota | Auth | Status |
|---|---|---|---|
| POST | `/api/medicoes` | Sim | ⚠️ Legada (sem DTO, sem Joi) |

### Solicitações de Compra (`/api/solicitacoes`)

| Método | Rota | Auth | Perfis | Status |
|---|---|---|---|---|
| GET | `/api/solicitacoes` | Sim | Todos | ✅ Funcional |
| GET | `/api/solicitacoes/:id` | Sim | Todos | ✅ Funcional |
| POST | `/api/solicitacoes` | Sim | Todos | ✅ Funcional |
| PUT | `/api/solicitacoes/:id/aprovar` | Sim | admin/supervisor | ✅ Funcional |
| PUT | `/api/solicitacoes/:id/rejeitar` | Sim | admin/supervisor | ✅ Funcional |

### Compras (`/api/purchases`)

| Método | Rota | Auth | Status |
|---|---|---|---|
| GET | `/api/purchases` | Sim | ✅ Funcional |
| GET | `/api/purchases/:id` | Sim | ✅ Funcional |
| POST | `/api/purchases` | Sim | ⚠️ Sem validação Joi |
| PUT | `/api/purchases/:id` | Sim | ⚠️ Sem validação Joi |
| DELETE | `/api/purchases/:id` | Sim | ✅ Funcional |

### Arquivos (`/api/files`)

| Método | Rota | Auth | Status |
|---|---|---|---|
| POST | `/api/files/upload` | Sim | ✅ Funcional |
| GET | `/api/files` | Sim | ✅ Funcional |
| GET | `/api/files/:id` | Sim | ✅ Funcional |
| DELETE | `/api/files/:id` | Sim | ✅ Funcional |
| GET | `/api/files/:id/download` | Sim | ✅ Funcional |

### Sincronização (`/api/sync`)

| Método | Rota | Auth | Status |
|---|---|---|---|
| POST | `/api/sync` | Sim | ✅ Funcional |
| GET | `/api/sync/status` | Sim | ✅ Funcional |

---

## 3. RESULTADOS DOS TESTES AUTOMATIZADOS

### Suítes de Teste

| Suíte | Arquivo | Testes | Resultado |
|---|---|---|---|
| ArquivoService (unitário) | `tests/unit/ArquivoService.test.js` | 11 | ✅ PASS |
| StorageService (unitário) | `tests/unit/StorageService.test.js` | 7 | ✅ PASS |
| Files Routes (integração) | `tests/integration/files.routes.test.js` | 15 | ✅ PASS |
| Auth Routes (integração) | `tests/integration/auth.routes.test.js` | 26 | ✅ PASS (NOVO) |
| Solicitacoes Routes (integração) | `tests/integration/solicitacoes.routes.test.js` | 16 | ✅ PASS (NOVO) |
| General Routes (integração) | `tests/integration/general.routes.test.js` | 19 | ✅ PASS (NOVO) |
| **TOTAL** | | **94** | **100% PASS** |

### Cobertura por Funcionalidade

| Funcionalidade | Antes | Depois |
|---|---|---|
| Autenticação | 0% | ~90% |
| Solicitações de Compra | 0% | ~75% |
| Obras | 0% | ~60% |
| Compras (purchases) | 0% | ~50% |
| Medições (rota legada) | 0% | ~40% |
| Upload de Arquivos | ~70% | ~70% |
| StorageService | ~85% | ~85% |

---

## 4. BUGS ENCONTRADOS E CORRIGIDOS

### BUG CRÍTICO #1 — `AppError.name` nunca definido

**Arquivo:** `src/utils/errors.js`  
**Severidade:** CRÍTICA  
**Impacto:** Todos os endpoints em `src/routes/medicoes.js` retornavam HTTP 500 em vez de 404/409/403

**Causa Raiz:**
```javascript
// ANTES (bugado)
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    // FALTAVA: this.name = this.constructor.name
  }
}
// Resultado: err.name === "Error" (herdado de Error.prototype)
// Rota medicoes.js verificava: if (err.name === "NotFoundError") → NUNCA era verdade
```

**Correção Aplicada:**
```javascript
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name; // ← ADICIONADO
  }
}
```

**Status:** ✅ CORRIGIDO em `src/utils/errors.js`

---

### BUG #2 — Coluna `refreshToken` ausente no banco de dados de testes

**Arquivo:** `tests/helpers/database.js`  
**Severidade:** MÉDIA (bloqueava testes de refresh token)  
**Impacto:** `POST /api/auth/refresh` retornava sempre 401 nos testes

**Causa Raiz:** A tabela `users` criada pelo helper de testes não tinha a coluna `refreshToken`. Durante `AuthService.login()`, o hash do refresh token era salvo no campo `refreshToken` do banco — mas como a coluna não existia, o valor nunca era persistido e toda requisição ao endpoint `/refresh` retornava 401.

**Correção Aplicada:**
```javascript
// tests/helpers/database.js
table.string("refreshToken").nullable(); // ← ADICIONADO
```

**Status:** ✅ CORRIGIDO em `tests/helpers/database.js`

---

## 5. VULNERABILIDADES DE SEGURANÇA IDENTIFICADAS

### SEG-01 — Segredos JWT com fallback inseguro (ALTA)

**Arquivo:** `src/config/jwt.js`

```javascript
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev_refresh_secret_change_me";
```

**Risco:** Em ambiente de produção sem variáveis de ambiente configuradas, tokens são assinados com segredos conhecidos — qualquer pessoa pode forjar tokens válidos.

**Recomendação:**
```javascript
if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT secrets must be set in production");
  }
}
```

---

### SEG-02 — Auto-registro como `admin` possível (ALTA)

**Arquivo:** `src/routes/auth.js` / `src/services/AuthService.js`

O endpoint `POST /api/auth/register` aceita o campo `perfil` diretamente do body sem restrição. Não há validação que impeça `perfil: "admin"`. Qualquer pessoa pode se registrar como administrador.

**Recomendação:**
```javascript
// src/services/AuthService.js — método register()
async register({ nome, email, senha }) { // não aceitar `perfil` do body
  const perfil = "encarregado"; // forçar perfil padrão
  // ...
}
```

---

### SEG-03 — IDOR em arquivos (MÉDIA)

**Arquivo:** `src/routes/files.js` / `src/controllers/ArquivoController.js`

Usuários autenticados podem acessar e deletar arquivos de outros usuários por ID sem verificação de propriedade.

**Recomendação:**
```javascript
const arquivo = await service.getById(id);
if (arquivo.userId !== req.user.id && req.user.perfil !== "admin") {
  throw new ForbiddenError("Acesso negado");
}
```

---

### SEG-04 — Rate limit global muito permissivo para autenticação (BAIXA)

O limite global de 100 req/15min é insuficiente para proteger endpoints de login contra força bruta.

**Recomendação:**
```javascript
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", loginLimiter);
```

---

### SEG-05 — Escopo do token Supabase não verificável no código (BAIXA/INFORMATIVO)

O `StorageService` usa `_sanitizeMessage()` para ocultar a chave Supabase nos logs — boa prática. Porém, o escopo/permissões da chave de serviço Supabase usada dependem de configuração externa e não podem ser auditados no código-fonte.

---

## 6. INCONSISTÊNCIAS E PROBLEMAS DE QUALIDADE

### INC-01 — Duas rotas paralelas para medições (MÉDIA)

| Rota | Arquivo | Características |
|---|---|---|
| `POST /api/medicoes` | `src/routes/medicoes.js` | Legada, sem DTO, sem Joi, try/catch próprio |
| `GET/POST/PUT/DELETE /api/measurements` | `src/routes/measurements.js` | Moderna, com DTO, Joi, RBAC |

**Recomendação:** Deprecar `/api/medicoes` e migrar clientes para `/api/measurements`.

---

### INC-02 — `errorHandler` com código legado MongoDB (BAIXA)

```javascript
// src/middleware/errorHandler.js
if (err.name === "CastError") { ... }      // MongoDB
if (err.code === 11000) { ... }            // MongoError: duplicate key
```

O projeto foi migrado para SQLite. Esses handlers nunca serão acionados.

**Recomendação:** Substituir por tratamento de erros SQLite (`SQLITE_CONSTRAINT_UNIQUE`, `SQLITE_CONSTRAINT_FOREIGNKEY`).

---

### INC-03 — `purchases` sem validação de entrada (MÉDIA)

`POST /api/purchases` e `PUT /api/purchases/:id` aceitam qualquer payload sem validação Joi. Campos críticos como `obra_id`, `valor`, `fornecedor` não são verificados antes da persistência.

---

### INC-04 — Import não utilizado em `MedicaoService` (BAIXA)

```javascript
// src/services/MedicaoService.js
const { retrySynt } = require("../utils/helpers"); // nunca utilizado
```

---

### INC-05 — `BaseRepository.create()` chama `columnInfo()` a cada operação (PERFORMANCE)

```javascript
async create(data) {
  const columns = await this.db(this.tableName).columnInfo(); // query extra a cada insert
  ...
}
```

Cada criação de registro faz 2 queries ao banco. Com volume alto de inserts, isso impacta a performance.

---

## 7. O QUE FUNCIONA CORRETAMENTE

- ✅ Autenticação JWT completa com access token + refresh token
- ✅ Hash de senhas e refresh tokens com bcrypt (cost factor 12)
- ✅ Middleware de autenticação e autorização por perfil (RBAC)
- ✅ Upload de arquivos com validação de tipo MIME + extensão
- ✅ Armazenamento local e Supabase com troca via variável de ambiente
- ✅ Soft delete em arquivos (`metadata.deletedAt`)
- ✅ Paginação genérica no `BaseRepository` (`limit`, `offset`)
- ✅ Hierarquia de erros customizados mapeados para códigos HTTP (após correção do bug)
- ✅ Middleware centralizado de tratamento de erros
- ✅ Validação Joi nos endpoints de autenticação e medições
- ✅ CORS configurável via `ALLOWED_ORIGINS`
- ✅ Rate limiting global
- ✅ Headers de segurança via Helmet
- ✅ Logging estruturado com Winston (arquivos separados por nível)
- ✅ Compressão gzip via `compression`
- ✅ DTOs sanitizando campos sensíveis (senha não exposta em respostas)

---

## 8. PONTOS CRÍTICOS — TABELA RESUMO

| ID | Categoria | Descrição | Prioridade |
|---|---|---|---|
| C-01 | Segurança | Auto-registro como admin sem restrição | 🔴 ALTA |
| C-02 | Segurança | JWT fallback secrets hardcoded | 🔴 ALTA |
| C-03 | Segurança | IDOR em endpoints de arquivos | 🟡 MÉDIA |
| C-04 | Qualidade | Duas rotas paralelas para medições | 🟡 MÉDIA |
| C-05 | Qualidade | Purchases sem validação de entrada | 🟡 MÉDIA |
| C-06 | Performance | `columnInfo()` a cada operação CRUD | 🟡 MÉDIA |
| C-07 | Manutenção | Código legado MongoDB no errorHandler | 🟢 BAIXA |
| C-08 | Manutenção | Import não utilizado (`retrySynt`) | 🟢 BAIXA |

---

## 9. RECOMENDAÇÕES TÉCNICAS (PRIORIZADAS)

1. 🔴 Restringir campo `perfil` no auto-registro — forçar `"encarregado"` por padrão
2. 🔴 Garantir `.env` configurado com JWT secrets fortes em produção
3. 🟡 Implementar verificação de propriedade nos endpoints de arquivos (IDOR)
4. 🟡 Criar validação Joi para `POST/PUT /api/purchases`
5. 🟡 Deprecar `/api/medicoes` e migrar para `/api/measurements`
6. 🟡 Cachear `columnInfo()` no `BaseRepository` para evitar query extra a cada insert
7. 🟢 Adicionar rate limit específico para login (max 10 req/15min)
8. 🟢 Limpar código legado MongoDB do `errorHandler.js`
9. 🟢 Implementar refresh token rotation (invalidar token anterior no uso)
10. 🟢 Adicionar índices no banco para `obra_id`, `userId`, `status`
11. 🟢 Expandir cobertura de testes para `/api/measurements` e `/api/purchases`
12. 🟢 Remover import não utilizado `retrySynt` do `MedicaoService`

---

## 10. INVENTÁRIO DE VARIÁVEIS DE AMBIENTE

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `NODE_ENV` | Não | `development` | Ambiente de execução |
| `PORT` | Não | `3000` | Porta do servidor |
| `JWT_SECRET` | **Produção** | `dev_jwt_secret_change_me` | Segredo para access tokens |
| `JWT_REFRESH_SECRET` | **Produção** | `dev_refresh_secret_change_me` | Segredo para refresh tokens |
| `JWT_EXPIRES_IN` | Não | `15m` | Expiração do access token |
| `JWT_REFRESH_EXPIRES_IN` | Não | `7d` | Expiração do refresh token |
| `DATABASE_URL` | Não | `./data/canteiro.db` | Caminho do banco SQLite |
| `STORAGE_PROVIDER` | Não | `local` | `local` ou `supabase` |
| `SUPABASE_URL` | Se Supabase | — | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Se Supabase | — | Chave de serviço Supabase |
| `SUPABASE_BUCKET` | Não | `arquivos` | Nome do bucket Supabase |
| `ALLOWED_ORIGINS` | Não | `*` | Origens CORS permitidas (csv) |
| `LOG_LEVEL` | Não | `info` | Nível de logging Winston |
| `UPLOAD_PATH` | Não | `./uploads` | Diretório de uploads locais |
| `MAX_FILE_SIZE` | Não | `10MB` | Tamanho máximo de arquivo |

---

## 11. ARQUIVOS CRIADOS/MODIFICADOS NESTA ANÁLISE

| Arquivo | Tipo | Descrição |
|---|---|---|
| `src/utils/errors.js` | CORRIGIDO | Adicionado `this.name = this.constructor.name` — **bug crítico** |
| `tests/helpers/database.js` | CORRIGIDO | Adicionada coluna `refreshToken` na tabela users de teste |
| `tests/helpers/fullDatabase.js` | CRIADO | Helper completo com todas as 7 tabelas para testes de integração |
| `tests/integration/auth.routes.test.js` | CRIADO | 26 testes para todos os endpoints de autenticação |
| `tests/integration/solicitacoes.routes.test.js` | CRIADO | 16 testes para solicitações de compra |
| `tests/integration/general.routes.test.js` | CRIADO | 19 testes para obras, compras, medições |

---

## 12. RESUMO EXECUTIVO

### Resultado Final dos Testes

```
Test Suites: 6 passed, 6 total
Tests:       94 passed, 94 total  (33 pré-existentes + 61 novos)
Snapshots:   0 total
Pass Rate:   100%
```

### Situação Geral do Back-end

O back-end está **funcionalmente operacional** com uma arquitetura bem estruturada e padrões adequados para o domínio da aplicação (gestão de canteiros de obra). A migração de MongoDB para SQLite foi concluída com sucesso. O sistema implementa corretamente autenticação JWT, controle de acesso por perfil (RBAC), upload de arquivos com múltiplos backends e uma estrutura de camadas (Repository → Service → Controller) que facilita manutenção e testes.

**Bugs corrigidos nesta análise:**
- Bug crítico em `AppError.name` que causava HTTP 500 incorreto nos endpoints de medições
- Schema incompleto no helper de banco de dados de testes (coluna `refreshToken` ausente)

**Atenção imediata necessária para:**
- Vulnerabilidade de auto-registro como admin (qualquer usuário pode se tornar admin)
- Configuração obrigatória de JWT secrets em produção

---

*Relatório gerado por análise estática de código e execução de 94 testes automatizados.*
