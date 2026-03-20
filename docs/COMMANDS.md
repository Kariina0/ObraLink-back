# Comandos operacionais

Comandos reais do backend com exemplos práticos para desenvolvimento, diagnóstico e manutenção.

## Sumário

- [Scripts npm oficiais](#scripts-npm-oficiais)
- [Operação de banco e dados](#operação-de-banco-e-dados)
- [Testes](#testes)
- [Exemplos de API com curl](#exemplos-de-api-com-curl)
- [Logs e troubleshooting](#logs-e-troubleshooting)
- [Catálogo de rotas](#catálogo-de-rotas)

## Scripts npm oficiais

```bash
npm run dev
npm start
npm run lint
npm test
npm run migrate
npm run migrate:rollback
npm run seed
npm run seed:sqlite
npm run seed:postgres
npm run seed:supabase
npm run migrate:local-files-to-supabase
npm run cleanup:orphans
npm run cleanup:orphans:execute
```

## Operação de banco e dados

Aplicar migrations:

```bash
npm run migrate
```

Rollback da última migration:

```bash
npm run migrate:rollback
```

Popular dados de desenvolvimento:

```bash
npm run seed:sqlite
```

## Testes

Execução recomendada:

```bash
npm test -- --runInBand
```

Com cobertura:

```bash
npm test -- --coverage --runInBand
```

Rodar uma suíte específica:

```bash
npm test -- tests/integration/auth.routes.test.js --runInBand
```

## Exemplos de API com curl

Login:

```bash
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@construcao.com\",\"senha\":\"admin123\"}"
```

Listar medições (admin/supervisor):

```bash
curl http://localhost:5000/api/measurements ^
  -H "Authorization: Bearer TOKEN"
```

Criar solicitação de compra:

```bash
curl -X POST http://localhost:5000/api/solicitacoes ^
  -H "Authorization: Bearer TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"itens\":[{\"descricao\":\"Cimento\",\"quantidade\":10,\"unidade\":\"saco\",\"valorUnitario\":39.9}],\"prioridade\":\"alta\"}"
```

## Logs e troubleshooting

Acompanhar logs:

```powershell
Get-Content .\logs\combined.log -Wait
Get-Content .\logs\error.log -Wait
```

Porta ocupada:

```powershell
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

## Catálogo de rotas

### Health e estatísticas

- `GET /api/health`
- `GET /api/stats`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `GET /api/auth/me`
- `GET /api/auth/users`

### Obras

- `GET /api/obras`
- `GET /api/obras/:id`
- `POST /api/obras`
- `PUT /api/obras/:id`
- `DELETE /api/obras/:id`
- `GET /api/obras/:id/encarregados/disponiveis`
- `POST /api/obras/:id/encarregados`
- `DELETE /api/obras/:id/encarregados/:userId`
- `PATCH /api/obras/:id/status`

### Medições

- `GET /api/measurements`
- `POST /api/measurements`
- `GET /api/measurements/minhas`
- `GET /api/measurements/rascunhos`
- `GET /api/measurements/obra/:obraId`
- `GET /api/measurements/:id`
- `PUT /api/measurements/:id`
- `DELETE /api/measurements/:id`
- `POST /api/measurements/:id/aprovar`
- `POST /api/measurements/:id/rejeitar`

### Diários

- `GET /api/diarios`
- `POST /api/diarios`
- `GET /api/diarios/check`
- `GET /api/diarios/minhas`
- `GET /api/diarios/:id`
- `PUT /api/diarios/:id`
- `DELETE /api/diarios/:id`

### Solicitações

- `POST /api/solicitacoes`
- `GET /api/solicitacoes`
- `GET /api/solicitacoes/:id`
- `POST /api/solicitacoes/:id/aprovar`
- `POST /api/solicitacoes/:id/rejeitar`

### Arquivos

- `GET /api/files/raw/:tipo/:filename`
- `POST /api/files/upload`
- `POST /api/files/upload-multiple`
- `GET /api/files/storage/usage`
- `GET /api/files/obra/:obraId`
- `GET /api/files/tipo/:tipo`
- `GET /api/files/:id`
- `DELETE /api/files/:id`

### Sync

- `GET /api/sync/pending`
- `POST /api/sync/push`
- `POST /api/sync/conflicts`
- `POST /api/sync/retry`

### Gestão

- `GET /api/management/overview`
- `GET /api/management/exports/obras.csv`
- `GET /api/management/exports/medicoes.csv`
- `GET /api/management/exports/boletim.pdf`

Referências: [INSTALL.md](INSTALL.md) e [REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md)
