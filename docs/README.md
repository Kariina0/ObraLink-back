# Sistema de Comunicação Ágil — Construtora RPG

## Contexto

O sistema foi desenvolvido para reduzir atrasos de comunicação entre **canteiro** e **escritório técnico**, padronizando o envio de:

- medições
- fotos e arquivos de acompanhamento
- diário de obra
- solicitações de compra
- indicadores operacionais de gestão

## Escopo implementado hoje

### Backend (`Projeto-backend-master`)

- Node.js + Express
- SQLite via Knex (schema controlado por migrations)
- JWT com access/refresh token
- RBAC (`admin`, `supervisor`, `encarregado`)
- Validação de payload com Joi
- Upload com Multer + Sharp (local ou Supabase)
- Sincronização via endpoints `/api/sync/*`

### Frontend (pasta irmã `../frontend`)

- React + React Router
- Axios com interceptor de refresh token
- Controle de acesso por perfil (`PrivateRoute`)
- Tela de sincronização e fila offline (IndexedDB)
- Upload offline de arquivos com retry e TTL

## Arquitetura real

```text
Frontend (React)
  -> API HTTP (/api/*)
Backend (Express)
  -> Middlewares (CORS, Helmet, Rate Limit, Auth, Validation)
  -> Controllers
  -> Services
  -> Repositories
  -> SQLite
```

## Funcionalidades principais

- Autenticação: login, refresh, logout, troca de senha, recuperação por código
- Obras: CRUD administrativo + vínculo N:N de encarregados
- Medições: criação, edição, listagem, aprovação/rejeição, filtros e paginação
- Diário de obra: criação, edição, listagem e exclusão lógica
- Solicitações: criação, listagem, aprovação/rejeição e cálculo de valor total
- Arquivos: upload único/múltiplo, classificação e acesso autenticado
- Gestão: visão gerencial consolidada + exportações CSV
- Sincronização: pending/push/conflicts/retry com Last-Write-Wins

## Banco de dados (migrations)

Tabelas ativas:

- `users`
- `obras`
- `obra_encarregados`
- `medicoes`
- `diarios`
- `solicitacoes_compra`
- `arquivos`

Observação: tabelas legadas `measurements` e `purchases` foram removidas por migration de 10/03/2026.

## API — resumo de endpoints

Base URL: `http://localhost:5000/api`

- `GET /health`
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/change-password`
- `GET/POST/PUT/DELETE /measurements`
- `GET/POST/PUT/DELETE /diarios`
- `POST /files/upload`, `POST /files/upload-multiple`, `GET /files/raw/:tipo/:filename`
- `GET/POST /sync/*`
- `GET/POST/PUT/DELETE /obras` + vínculo de encarregados
- `GET/POST /solicitacoes` + `POST /:id/aprovar|rejeitar`
- `GET /management/overview`, `GET /management/exports/*.csv`

## Limitações atuais

- Exportação PDF de boletim não implementada (endpoint retorna `501`)
- Tokens no frontend permanecem em `localStorage` (risco residual de XSS)

## Referências

- `docs/STRUCTURE.md`
- `docs/INSTALL.md`
- `docs/COMMANDS.md`
- `docs/REGRAS_NEGOCIO.md`
- `docs/RELATORIO_TESTES.md`