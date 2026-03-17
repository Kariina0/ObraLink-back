# ObraLink — Sistema de Comunicação Ágil para Obras

> Solução de gestão operacional entre canteiro e escritório técnico da Construtora RPG.

---

## Visão geral

O **ObraLink** foi desenvolvido para eliminar gargalos de comunicação entre o **canteiro de obras** e o **escritório técnico**, centralizando e padronizando o registro e aprovação de:

| Módulo | Descrição |
|--------|-----------|
| Medições | Registro estruturado com cálculo geométrico e fluxo de aprovação |
| Diário de obra | Registro diário de atividades, clima, equipe e ocorrências |
| Solicitações de compra | Criação, priorização e aprovação com valor calculado |
| Fotos e arquivos | Upload com compressão, classificação e acesso autenticado |
| Sincronização | Operação offline com fila local e reconciliação automática |
| Gestão | Visão consolidada e exportação de dados para o escritório |

---

## Stack tecnológica

### Backend

| Tecnologia | Uso |
|------------|-----|
| Node.js `>=18` | Runtime |
| Express | Servidor HTTP |
| Knex + SQLite | ORM/query builder e banco de dados local |
| JWT (access + refresh) | Autenticação stateless |
| Joi | Validação de payloads |
| Multer + Sharp | Upload e compressão de imagens |
| Winston | Logging estruturado |
| Helmet + express-rate-limit | Segurança HTTP |
| Supabase (opcional) | Storage em nuvem alternativo |

### Frontend

| Tecnologia | Uso |
|------------|-----|
| React 19 | UI |
| React Router v6 | Navegação e rotas protegidas |
| Axios | Cliente HTTP com interceptor de refresh token |
| idb (IndexedDB) | Persistência offline |
| Context API | Gerenciamento de sessão (`AuthContext`) |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                  │
│  páginas → serviços → AuthContext → PrivateRoute    │
│  fila offline (IndexedDB) → SyncManager             │
└────────────────────┬────────────────────────────────┘
                     │ HTTP /api/*
┌────────────────────▼────────────────────────────────┐
│                   Backend (Express)                 │
│  CORS · Helmet · Rate Limit                         │
│  → Router → authenticate/authorize                  │
│  → validate (Joi)                                   │
│  → Controller → Service → Repository               │
│  → SQLite (Knex)                                    │
└─────────────────────────────────────────────────────┘
```

---

## Perfis de acesso (RBAC)

| Perfil | Permissões principais |
|--------|----------------------|
| `admin` | Acesso total: cadastros, aprovações, gestão, exportações |
| `supervisor` | Aprovar/rejeitar medições e solicitações; visualizar todas as obras |
| `encarregado` | Criar e editar dados das obras vinculadas; sem aprovação |

---

## Funcionalidades implementadas

### Autenticação e sessão
- Login com email/senha → JWT access token (15 min) + refresh token (7 dias)
- Rotação de refresh token a cada renovação
- Recuperação de senha por código numérico de 6 dígitos com TTL configurável
- Troca de senha autenticada
- Rate limit dedicado para rotas de autenticação

### Obras
- CRUD completo (somente `admin`)
- Código único por obra, gerado automaticamente se omitido
- Vínculo N:N obra ↔ encarregado (`obra_encarregados`)

### Medições
- Campos obrigatórios: `obra`, `itens`
- Cálculo automático de `areaCalculada` e `volume` quando dimensões são fornecidas
- Fluxo de aprovação/rejeição com motivo registrado
- `encarregado` edita apenas medições próprias; medição `aprovada` é bloqueada para edição por não-admin

### Diário de obra
- Campos obrigatórios: `obra`, `atividades` (mínimo 1 item)
- `clima` restrito a enum `ensolarado | nublado | chuvoso | ventania | instavel`
- Arrays e objetos serializados em JSON no banco

### Solicitações de compra
- `valorTotal` calculado no backend (`∑ quantidade × valorUnitário`)
- Prioridades: `baixa | media | alta | urgente`
- Status inicial `pendente`; aprovação/rejeição registra responsável e data

### Arquivos
- Upload único e múltiplo com validação por magic bytes
- Compressão com Sharp (configurável)
- Acesso autenticado via `/api/files/raw/:tipo/:filename`, protegido contra path traversal
- Storage configurável: `local` ou `supabase`

### Sincronização offline
- Fila local no frontend (IndexedDB) com retry e TTL
- Endpoints: `/api/sync/pending`, `/push`, `/conflicts`, `/retry`
- Estratégia de resolução: **Last-Write-Wins** por timestamp cliente vs. servidor

### Gestão
- Dashboard consolidado por obra
- Exportações CSV de medições, diários e solicitações
- Exportação PDF de boletim: **não implementada** (retorna `501`)

---

## Banco de dados

> Banco padrão: **SQLite** — arquivo em `data/`, gerenciado por migrations Knex.

Tabelas ativas:

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários do sistema |
| `obras` | Cadastro de obras |
| `obra_encarregados` | Relação N:N obra ↔ usuário |
| `medicoes` | Boletins de medição |
| `diarios` | Registros diários de obra |
| `solicitacoes_compra` | Solicitações de material |
| `arquivos` | Metadados de arquivos enviados |

> Tabelas legadas `measurements` e `purchases` foram removidas pela migration de 10/03/2026.

---

## API — Endpoints disponíveis

**Base URL:** `http://localhost:5000/api`

| Rota | Método(s) | Descrição |
|------|-----------|-----------|
| `/health` | GET | Verificação de saúde da API |
| `/stats` | GET | Estatísticas básicas |
| `/auth/login` | POST | Login com email/senha |
| `/auth/refresh` | POST | Renovação de access token |
| `/auth/logout` | POST | Invalidação de refresh token |
| `/auth/me` | GET | Dados do usuário autenticado |
| `/auth/register` | POST | Cadastro (somente `admin`) |
| `/auth/forgot-password` | POST | Solicitar código de recuperação |
| `/auth/reset-password` | POST | Redefinir senha por código |
| `/auth/change-password` | POST | Troca de senha autenticada |
| `/obras` | GET/POST/PUT/DELETE | CRUD de obras |
| `/obras/:id/encarregados` | POST/DELETE | Vínculos de encarregados |
| `/measurements` | GET/POST/PUT/DELETE | Medições |
| `/measurements/:id/aprovar` | POST | Aprovação de medição |
| `/measurements/:id/rejeitar` | POST | Rejeição de medição |
| `/diarios` | GET/POST/PUT/DELETE | Diário de obra |
| `/solicitacoes` | GET/POST | Solicitações de compra |
| `/solicitacoes/:id/aprovar` | POST | Aprovação de solicitação |
| `/solicitacoes/:id/rejeitar` | POST | Rejeição de solicitação |
| `/files/upload` | POST | Upload único |
| `/files/upload-multiple` | POST | Upload múltiplo |
| `/files/raw/:tipo/:filename` | GET | Acesso autenticado a arquivo |
| `/sync/pending` | GET | Itens pendentes de sync |
| `/sync/push` | POST | Envio de lote offline |
| `/sync/conflicts` | GET | Conflitos de sincronização |
| `/sync/retry` | POST | Reprocessamento de itens com erro |
| `/management/overview` | GET | Dashboard gerencial |
| `/management/exports/medicoes.csv` | GET | Exportação CSV de medições |
| `/management/exports/diarios.csv` | GET | Exportação CSV de diários |

---

## Limitações conhecidas

| Item | Situação |
|------|----------|
| Exportação PDF de boletim | Não implementada — endpoint retorna `501` |
| Tokens de sessão no frontend | Armazenados em `localStorage` (risco XSS residual) |
| Soft delete | Padrão híbrido: coluna `deletedAt` e/ou campo em `metadata` |

---

## Documentação relacionada

| Arquivo | Conteúdo |
|---------|----------|
| [STRUCTURE.md](STRUCTURE.md) | Estrutura de pastas e camadas do projeto |
| [INSTALL.md](INSTALL.md) | Instalação e execução local |
| [COMMANDS.md](COMMANDS.md) | Comandos operacionais e utilitários |
| [REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md) | Regras de negócio detalhadas |
| [ROADMAP.md](ROADMAP.md) | Próximos passos técnicos priorizados |
| [RELATORIO_TESTES.md](RELATORIO_TESTES.md) | Estado dos testes automatizados |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Guia de contribuição e padrões |