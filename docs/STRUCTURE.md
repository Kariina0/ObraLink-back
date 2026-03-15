# Estrutura técnica real do projeto

## 1. Repositório backend (`Projeto-backend-master`)

```text
.
├── knexfile.js
├── package.json
├── migrations/
├── scripts/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   ├── constants/
│   ├── controllers/
│   ├── dtos/
│   ├── middleware/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── validators/
├── tests/
├── uploads/
├── logs/
└── docs/
```

### Responsabilidade por camada

- `routes/`: definição de endpoints e aplicação de middlewares
- `controllers/`: adaptação HTTP (`req`/`res`) e retorno de DTOs
- `services/`: regras de negócio e autorização de domínio
- `repositories/`: acesso a dados com Knex
- `validators/`: contratos de entrada com Joi
- `middleware/`: autenticação JWT, autorização RBAC, validação e tratamento de erros
- `migrations/`: versão oficial do schema

## 2. Banco de dados

Banco padrão: **SQLite** (arquivo em `data/`, conforme `knexfile.js`).

Principais tabelas:

- `users`
- `obras`
- `obra_encarregados`
- `medicoes`
- `diarios`
- `solicitacoes_compra`
- `arquivos`

Observações:

- o código usa **soft delete** misto (`deletedAt` em colunas e/ou `metadata.deletedAt`)
- migrations legadas `measurements` e `purchases` foram removidas por migration posterior

## 3. Rotas existentes

Registradas em `src/routes/index.js`:

- `/api/health`
- `/api/stats`
- `/api/auth/*`
- `/api/measurements/*`
- `/api/diarios/*`
- `/api/files/*`
- `/api/sync/*`
- `/api/obras/*`
- `/api/solicitacoes/*`
- `/api/management/*`

## 4. Frontend consumindo a API (pasta irmã)

O frontend está em `../frontend` e possui:

- `src/pages/`: telas de login, dashboard, medições, diário, solicitações, uploads, sincronização
- `src/services/`: integração com API (`api.js`, `medicoesService.js`, `filesService.js`, etc.)
- `src/context/AuthContext.js`: sessão de usuário
- `src/utils/db.js` e `src/utils/syncQueue.js`: persistência offline em IndexedDB

## 5. Fluxo padrão de requisição

```text
HTTP Request
-> app.js (CORS, Helmet, Rate Limit)
-> Router
-> authenticate / authorize
-> validate Joi
-> Controller
-> Service
-> Repository
-> SQLite
-> DTO + resposta padronizada
```
