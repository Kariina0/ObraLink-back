# Plano de Evolução do Sistema — Gestão de Obras RPG

> Documento de referência permanente para evolução técnica e funcional do sistema.
> Última atualização: 11/03/2026

---

## 1 — Visão Geral do Sistema

### Objetivo

O sistema de Gestão de Obras foi desenvolvido para a **Construtora RPG** com o objetivo de digitalizar e padronizar a comunicação entre o canteiro de obras e o escritório técnico.

### Problema operacional

A construtora enfrenta atrasos recorrentes no envio de informações do canteiro para o escritório, causados por:

- Envio manual de dados por diferentes canais (WhatsApp, e-mail, papel)
- Falta de padronização nas informações enviadas
- Acúmulo de responsabilidades dos encarregados
- Dificuldade dos encarregados com ferramentas digitais
- Ausência de um canal único e estruturado de comunicação

Isso resulta em atrasos no planejamento, compra de materiais fora do prazo, dificuldade de acompanhamento pelo setor técnico e risco de descumprimento contratual.

### Solução

O sistema oferece um canal único e padronizado onde encarregados registram medições, solicitam materiais, enviam fotos e documentos — e supervisores/administradores aprovam, acompanham e gerenciam obras em tempo real.

---

## 2 — Arquitetura Atual do Sistema

### 2.1 — Backend (Node.js / Express)

**Localização:** `Projeto-backend-master/`

#### Camadas

```
Routes → Controllers → Services → Repositories → Database (SQLite / Knex)
```

| Camada | Diretório | Responsabilidade |
|---|---|---|
| Routes | `src/routes/` | Define endpoints HTTP e aplica middlewares (auth, validação) |
| Controllers | `src/controllers/` | Recebe requisições, delega para services, formata respostas |
| Services | `src/services/` | Regras de negócio, validações complexas, orquestração |
| Repositories | `src/repositories/` | Acesso ao banco de dados via Knex query builder |
| DTOs | `src/dtos/` | Serialização de dados de saída (remove campos sensíveis) |
| Middleware | `src/middleware/` | Autenticação JWT, autorização por perfil, tratamento de erros, validação |
| Validators | `src/validators/` | Schemas Joi para validação de entrada |
| Utils | `src/utils/` | Erros tipados, helpers, logger Winston, validação de tipos de arquivo |
| Config | `src/config/` | Configuração de banco, JWT e Multer |
| Constants | `src/constants/` | Perfis, status, tipos, mensagens, limites |

#### Autenticação JWT

- Access token (15 min) + Refresh token (7 dias)
- Refresh token armazenado como hash bcrypt no banco
- Rotação de refresh token a cada uso
- Middleware `authenticate` verifica token em rotas protegidas
- Middleware `authorize(...perfis)` controla acesso por perfil (admin, supervisor, encarregado)
- Reset de senha com código numérico de 6 dígitos (TTL configurável)

#### Banco de Dados

- **Desenvolvimento:** SQLite via Knex query builder
- **Produção (previsto):** PostgreSQL (configuração já presente no `knexfile.js`)
- **Migrations:** 6 arquivos versionados em `migrations/`
- **Tabelas principais:** `users`, `obras`, `medicoes`, `arquivos`, `solicitacoes_compra`, `diarios`, `obra_encarregados`
- **Tabelas legadas (não utilizadas):** `measurements`, `purchases`

#### Upload de Arquivos

- **Multer** para recepção de arquivos
- **StorageService** com dois provedores:
  - `local`: salva em disco (`./uploads/`), serve como estático
  - `supabase`: upload para bucket privado com URLs assinadas (1h)
- Filtro de tipos MIME (JPEG, PNG, PDF por padrão)
- Limite de 5 MB por arquivo
- Validação de magic bytes (`fileTypeValidator`)
- Limpeza automática de uploads falhos em modo local

#### Sincronização

- `SyncService` com endpoints `GET /api/sync/pull` e `POST /api/sync/push`
- Estratégia Last-Write-Wins para resolução de conflitos
- Suporta medições, diários, solicitações e arquivos
- **Observação:** o frontend atualmente NÃO consome esses endpoints

#### Segurança

- Helmet (headers de segurança)
- CORS configurável via `ALLOWED_ORIGINS`
- Rate limiting global (100 req/15min)
- Compressão gzip
- Logger Winston com rotação de arquivos
- Sanitização de chaves sensíveis nos logs do Supabase

### 2.2 — Frontend (React)

**Localização:** `frontend/`

#### Estrutura

```
src/
├── pages/          → 12 páginas (Login, Dashboard, EnviarMedicao, etc.)
├── components/     → Layout, PrivateRoute, Icons
├── services/       → 6 services de API (api, medicoes, obras, files, purchases, users)
├── context/        → AuthContext (estado global de autenticação)
├── constants/      → Permissões por rota, constantes de medição, status
├── utils/          → IndexedDB offline, normalização, validação de senha
└── styles/         → CSS com variáveis e media queries responsivos
```

#### AuthContext

- Estado global de autenticação via React Context
- Carrega usuário do `localStorage` ao iniciar e valida com `GET /api/auth/me`
- Abordagem otimista: mantém sessão em erros de rede (5xx), invalida apenas em 401/403
- Funções `login()`, `logout()` e flag `authChecked` para evitar flash de redirect

#### Interceptor de API (Axios)

- Injeta token JWT em todas as requisições
- Refresh automático em 401 com fila de requisições pendentes (evita race condition)
- Dispatch de evento `auth:logout` para forçar limpeza global

#### Controle de Rotas

- `ROUTE_PERMISSIONS` define perfis permitidos por rota
- `PrivateRoute` verifica autenticação e permissão antes de renderizar
- 3 níveis: todos os perfis, supervisor+admin, somente admin

#### IndexedDB Offline (Upload de Arquivos)

- Arquivos salvos como `ArrayBuffer` no IndexedDB quando offline
- Metadados preservados (obra, tipoArquivo, descricao)
- Sincronização automática ao reconectar
- Retry com limite de 5 tentativas
- TTL de 7 dias para arquivos pendentes
- Limpeza automática de registros expirados

#### Responsividade

- CSS com media queries em 375px, 480px, 600px, 768px, 1024px, 1280px
- Menu hambúrguer para mobile
- Layouts flexíveis com grid responsivo

---

## 3 — Principais Funcionalidades Implementadas

### 3.1 — Login e Autenticação

| Item | Status |
|---|---|
| Login com e-mail e senha | ✔ Implementado |
| JWT com refresh token | ✔ Implementado |
| Logout com invalidação de refresh token | ✔ Implementado |
| Troca de senha (com validação de complexidade) | ✔ Implementado |
| Cadastro de funcionários (somente admin) | ✔ Implementado |
| Reset de senha por código numérico | ✔ Backend pronto / ❌ Sem tela no frontend |

### 3.2 — Gestão de Obras

| Item | Status |
|---|---|
| Listagem de obras com filtros (nome, status) | ✔ Implementado |
| Cadastro de nova obra (admin) | ✔ Implementado |
| Edição de obra (admin) | ✔ Implementado |
| Exclusão de obra (soft delete — admin) | ⚠ Parcial (não filtra deletadas nas consultas) |
| Vinculação de encarregados a obras (N:N) | ✔ Implementado |
| Desvinculação de encarregados | ✔ Implementado |
| Encarregado vê apenas suas obras | ✔ Implementado |

### 3.3 — Envio de Medições

| Item | Status |
|---|---|
| Formulário estruturado (obra, área, tipo de serviço, dimensões) | ✔ Implementado |
| Cálculo automático de área (C × L) e volume (C × L × A) | ✔ Implementado |
| Upload de foto associada à medição | ✔ Implementado |
| Listagem de medições com filtros avançados (obra, status, tipo, período, responsável) | ✔ Implementado |
| Paginação server-side | ✔ Implementado |
| Aprovação/rejeição por supervisor com motivo | ✔ Implementado |
| Tela "Meus Relatórios" com detalhes expandíveis | ✔ Implementado |

### 3.4 — Solicitação de Compras

| Item | Status |
|---|---|
| Catálogo de 200+ materiais em 10 categorias | ✔ Implementado |
| Seleção por checkbox (sem digitação livre) | ✔ Implementado |
| Prioridade (baixa, média, alta, urgente) | ✔ Implementado |
| Listagem com status e paginação | ✔ Implementado |
| Aprovação/rejeição por supervisor com motivo | ✔ Implementado |

### 3.5 — Upload de Arquivos

| Item | Status |
|---|---|
| Upload com tipagem obrigatória (foto_obra, medição, relatório, problema, etc.) | ✔ Implementado |
| Vinculação obrigatória a uma obra | ✔ Implementado |
| Descrição obrigatória (mín. 3 caracteres) | ✔ Implementado |
| Campo condicional "detalhe do problema" | ✔ Implementado |
| Modo offline com IndexedDB | ✔ Implementado |
| Sincronização automática ao reconectar | ✔ Implementado |
| Retry com limite (5 tentativas) e TTL (7 dias) | ✔ Implementado |

### 3.6 — Gestão de Usuários

| Item | Status |
|---|---|
| Cadastro de funcionários (somente admin) | ✔ Implementado |
| Listagem de usuários (admin/supervisor) | ✔ Implementado |
| Perfil do usuário com dados da conta | ✔ Implementado |
| Troca de senha pelo próprio usuário | ✔ Implementado |

### 3.7 — Painel Administrativo

| Item | Status |
|---|---|
| Estatísticas via COUNT SQL (total obras, medições, solicitações, arquivos) | ✔ Implementado |
| Indicadores de itens pendentes | ✔ Implementado |
| Links rápidos para gerenciamento | ✔ Implementado |

### 3.8 — Diário de Obra (RDO)

| Item | Status |
|---|---|
| Tabela `diarios` no banco de dados | ✔ Schema existe |
| `DiarioRepository` com CRUD | ✔ Backend existe |
| Controller / Rotas de API | ❌ Não implementado |
| Tela no frontend | ❌ Não implementado |

---

## 4 — Problemas Identificados na Análise Técnica

### 4.1 — Problemas de Integração

| # | Problema | Impacto | Arquivos |
|---|---------|---------|----------|
| P-01 | Porta da API divergente: `.env` do frontend define `5000`, backend usa `5001` | Falha de conexão front→back | `frontend/.env`, `src/server.js` |
| P-02 | README do frontend menciona MongoDB; banco real é SQLite/Knex | Confusão para novos desenvolvedores | `frontend/README.md` |
| P-03 | Service `listMedicoesByObra()` existe no frontend mas não é chamado em nenhuma tela | Código morto | `frontend/src/services/medicoesService.js` |

### 4.2 — Problemas de Backend

| # | Problema | Impacto | Arquivos |
|---|---------|---------|----------|
| P-04 | Soft delete de obras não filtra registros excluídos nas consultas | Obras deletadas podem aparecer nas listagens | `src/services/ObraService.js`, `src/repositories/ObraRepository.js` |
| P-05 | Tabelas legadas `measurements` e `purchases` existem no schema mas não são usadas | Confusão, ocupam espaço no schema | `migrations/20260224_initial_schema.js` |
| P-06 | SQLite como banco de dados — não suporta alta concorrência | Timeouts com múltiplos usuários simultâneos | `knexfile.js`, `src/config/database.js` |
| P-07 | Rate limiting global (100 req/15min) sem proteção específica para login | Vulnerável a brute force no endpoint de autenticação | `src/app.js` |
| P-08 | Uploads locais servidos como estático sem autenticação em produção | Arquivos acessíveis publicamente sem token | `src/app.js` |
| P-09 | Tokens JWT armazenados no localStorage | Vulnerável a XSS | `frontend/src/context/AuthContext.js`, `frontend/src/services/api.js` |

### 4.3 — Problemas de Frontend

| # | Problema | Impacto | Arquivos |
|---|---------|---------|----------|
| P-10 | Sem PWA real (service worker ausente) | App não instala no celular, sem cache offline de recursos | `frontend/public/manifest.json` |
| P-11 | `manifest.json` com textos genéricos ("Create React App Sample") | Identidade visual incompleta no mobile | `frontend/public/manifest.json`, `frontend/public/index.html` |
| P-12 | Inline styles extensivos nas páginas | Dificulta manutenção e consistência visual | `frontend/src/pages/*.jsx` |
| P-13 | Sem testes automatizados no frontend | Regressões difíceis de detectar | `frontend/src/` |

### 4.4 — Funcionalidades Ausentes

| # | Problema | Impacto |
|---|---------|---------|
| P-14 | Diário de obra (RDO) sem implementação no frontend | Funcionalidade crítica para acompanhamento diário ausente |
| P-15 | Sincronização offline funciona apenas para uploads; medições e solicitações exigem conexão | Encarregados em áreas sem internet não conseguem registrar medições |
| P-16 | Sem sistema de notificações (push, e-mail ou in-app) | Atrasos no envio de informações não são detectados proativamente |
| P-17 | Sem exportação de relatórios (PDF/Excel) | Escritório não gera documentos para contratantes |
| P-18 | Tela de reset de senha não existe no frontend | Backend pronto mas funcionalidade inacessível |
| P-19 | Sem termos de uso ou aviso de privacidade (LGPD) | Risco de não conformidade legal |

---

## 5 — Plano de Evolução do Sistema

### 5.1 — CORREÇÕES CRÍTICAS

Problemas que precisam ser resolvidos primeiro para garantir o funcionamento correto do sistema.

#### CC-01: Corrigir divergência de porta da API
- **Problema:** P-01
- **Ação:** Alinhar `frontend/.env` com a porta real do backend (`5001`) ou configurar ambos para a mesma porta
- **Arquivos:** `frontend/.env`
- **Complexidade:** Baixa

#### CC-02: Proteger uploads em produção
- **Problema:** P-08
- **Ação:** Implementar middleware de autenticação obrigatória para servir arquivos em modo local, ou documentar que `STORAGE_PROVIDER=supabase` é obrigatório em produção
- **Arquivos:** `src/app.js`
- **Complexidade:** Média

#### CC-03: Corrigir soft delete de obras
- **Problema:** P-04
- **Ação:** Filtrar obras com `metadata.deletedAt` nas consultas de listagem, ou implementar campo `deletedAt` como coluna real
- **Arquivos:** `src/repositories/ObraRepository.js`, `src/services/ObraService.js`
- **Complexidade:** Média

#### CC-04: Adicionar rate limiting específico para login
- **Problema:** P-07
- **Ação:** Configurar rate limiter dedicado no endpoint `POST /api/auth/login` (máx. 5 tentativas/minuto por IP)
- **Arquivos:** `src/routes/auth.js`, `src/app.js`
- **Complexidade:** Baixa

#### CC-05: Atualizar manifest.json e index.html com identidade do sistema
- **Problema:** P-11
- **Ação:** Substituir textos genéricos por "Gestão de Obras RPG", adicionar descrição, cores da marca
- **Arquivos:** `frontend/public/manifest.json`, `frontend/public/index.html`
- **Complexidade:** Baixa

### 5.2 — MELHORIAS ESTRUTURAIS

Melhorias de arquitetura, segurança e qualidade técnica.

#### ME-01: Implementar PWA com Service Worker
- **Problema:** P-10
- **Ação:** Configurar service worker para cache de assets, manifest correto, instalação na tela inicial do celular
- **Arquivos:** `frontend/public/`, `frontend/src/index.js`
- **Complexidade:** Alta

#### ME-02: Migrar para PostgreSQL em produção
- **Problema:** P-06
- **Ação:** Configurar variáveis de ambiente para PostgreSQL, testar migrations, documentar processo
- **Arquivos:** `knexfile.js`, `.env`
- **Complexidade:** Média

#### ME-03: Implementar sincronização offline completa
- **Problema:** P-15
- **Ação:** Estender IndexedDB no frontend para medições e solicitações; consumir endpoints `GET /api/sync/pull` e `POST /api/sync/push`
- **Arquivos:** `frontend/src/utils/db.js`, `frontend/src/services/` (novo syncService), `frontend/src/pages/EnviarMedicao.jsx`, `frontend/src/pages/PurchaseRequest.jsx`
- **Complexidade:** Alta

#### ME-04: Migrar tokens JWT para httpOnly cookies
- **Problema:** P-09
- **Ação:** Backend envia tokens via `Set-Cookie` com flags `httpOnly`, `Secure`, `SameSite=Strict`; frontend remove localStorage de tokens
- **Arquivos:** `src/config/jwt.js`, `src/routes/auth.js`, `src/middleware/auth.js`, `frontend/src/services/api.js`, `frontend/src/context/AuthContext.js`
- **Complexidade:** Alta

#### ME-05: Refatorar inline styles para classes CSS
- **Problema:** P-12
- **Ação:** Extrair `style={{...}}` mais frequentes para classes em `pages.css`/`main.css`
- **Arquivos:** `frontend/src/pages/*.jsx`, `frontend/src/styles/pages.css`
- **Complexidade:** Média

#### ME-06: Adicionar testes automatizados no frontend
- **Problema:** P-13
- **Ação:** Testes unitários para services e utils; testes de integração para fluxos principais (login, medição, solicitação)
- **Arquivos:** `frontend/src/__tests__/` (novo)
- **Complexidade:** Alta

#### ME-07: Remover tabelas e código legado
- **Problema:** P-05, P-03
- **Ação:** Remover tabelas `measurements` e `purchases` via nova migration; remover `listMedicoesByObra` se não for utilizado
- **Arquivos:** `migrations/` (nova), `frontend/src/services/medicoesService.js`
- **Complexidade:** Baixa

#### ME-08: Atualizar README do frontend
- **Problema:** P-02
- **Ação:** Corrigir referência de MongoDB para SQLite/Knex; documentar setup correto
- **Arquivos:** `frontend/README.md`
- **Complexidade:** Baixa

### 5.3 — EVOLUÇÃO FUNCIONAL

Novas funcionalidades que ampliam o valor da solução.

#### EF-01: Implementar Diário de Obra (RDO)
- **Problema:** P-14
- **Ação:** Criar rotas no backend (`src/routes/diarios.js`), controller, e tela no frontend com formulário para: data, clima, atividades realizadas, mão de obra presente, equipamentos utilizados, materiais consumidos, ocorrências, fotos do dia, observações gerais
- **Arquivos:** `src/routes/diarios.js` (novo), `src/controllers/DiarioController.js` (novo), `src/services/DiarioService.js` (novo), `frontend/src/pages/DiarioObra.jsx` (novo), `frontend/src/services/diariosService.js` (novo)
- **Complexidade:** Alta
- **Prioridade:** Máxima — RDO é documento obrigatório no dia a dia de canteiro

#### EF-02: Implementar sistema de notificações
- **Problema:** P-16
- **Ação:** Notificações in-app (badge no menu) e opcionalmente por e-mail para: medições pendentes de aprovação, solicitações aprovadas/rejeitadas, medições não enviadas após X dias
- **Arquivos:** `src/services/NotificacaoService.js` (novo), `src/routes/notificacoes.js` (novo), `frontend/src/components/NotificationBadge.jsx` (novo)
- **Complexidade:** Alta

#### EF-03: Implementar exportação de relatórios (PDF)
- **Problema:** P-17
- **Ação:** Endpoint que gera PDF com medições filtradas (usando biblioteca como `pdfkit` ou `puppeteer`); botão "Exportar PDF" nas telas de relatórios
- **Arquivos:** `src/services/RelatorioService.js` (novo), `src/routes/relatorios.js` (novo), `frontend/src/pages/MeusRelatorios.jsx`, `frontend/src/pages/measurements.jsx`
- **Complexidade:** Média

#### EF-04: Implementar tela de reset de senha
- **Problema:** P-18
- **Ação:** Tela no frontend com fluxo: informar e-mail → receber código → digitar código + nova senha
- **Arquivos:** `frontend/src/pages/ResetSenha.jsx` (novo), `frontend/src/App.jsx`
- **Complexidade:** Baixa

#### EF-05: Adicionar conformidade LGPD
- **Problema:** P-19
- **Ação:** Tela de termos de uso e política de privacidade; checkbox de aceite no cadastro; endpoint para solicitar exclusão de dados pessoais
- **Arquivos:** `frontend/src/pages/TermosUso.jsx` (novo), `frontend/src/pages/Register.jsx`, `src/routes/auth.js`
- **Complexidade:** Média

#### EF-06: Dashboard visual com gráficos
- **Ação:** Gráficos de medições por período, solicitações por status, progresso por obra (usando `recharts` ou `chart.js`)
- **Arquivos:** `frontend/src/pages/AdminPanel.jsx`, `frontend/src/pages/Dashboard.jsx`
- **Complexidade:** Média

#### EF-07: Modo câmera direta e geolocalização
- **Ação:** Botão que abre câmera do celular diretamente; captura automática de coordenadas GPS ao registrar medição ou foto (o schema já tem campo `coordenadas`)
- **Arquivos:** `frontend/src/pages/EnviarMedicao.jsx`, `frontend/src/pages/Upload.jsx`
- **Complexidade:** Média

#### EF-08: Fluxo completo de compras (cotação → entrega)
- **Ação:** Estender solicitação de compra com etapas: cotação, pedido, entrega, conferência de quantidade
- **Arquivos:** `src/repositories/SolicitacaoCompraRepository.js`, `frontend/src/pages/StatusSolicitacao.jsx`
- **Complexidade:** Alta

---

## 6 — Roadmap de Implementação Recomendado

### Fase 1 — Estabilização (Prioridade Imediata)

Corrigir problemas que afetam o funcionamento básico e a segurança.

| Ordem | Item | Ref. | Complexidade |
|-------|------|------|-------------|
| 1 | Corrigir porta da API no `.env` do frontend | CC-01 | Baixa |
| 2 | Atualizar manifest.json e index.html | CC-05 | Baixa |
| 3 | Atualizar README do frontend | ME-08 | Baixa |
| 4 | Adicionar rate limiting no login | CC-04 | Baixa |
| 5 | Proteger uploads em produção | CC-02 | Média |
| 6 | Corrigir soft delete de obras | CC-03 | Média |
| 7 | Remover tabelas e código legado | ME-07 | Baixa |

### Fase 2 — Funcionalidades Essenciais

Implementar funcionalidades ausentes que são críticas para o uso real.

| Ordem | Item | Ref. | Complexidade |
|-------|------|------|-------------|
| 8 | Implementar Diário de Obra (RDO) | EF-01 | Alta |
| 9 | Implementar tela de reset de senha | EF-04 | Baixa |
| 10 | Implementar PWA com Service Worker | ME-01 | Alta |
| 11 | Implementar sincronização offline completa | ME-03 | Alta |

### Fase 3 — Segurança e Infraestrutura

Preparar o sistema para uso em produção real.

| Ordem | Item | Ref. | Complexidade |
|-------|------|------|-------------|
| 12 | Migrar para PostgreSQL em produção | ME-02 | Média |
| 13 | Migrar tokens para httpOnly cookies | ME-04 | Alta |
| 14 | Adicionar conformidade LGPD | EF-05 | Média |
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
