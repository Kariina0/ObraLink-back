# Comandos operacionais

## Backend — scripts npm

```bash
# desenvolvimento
npm run dev

# produção
npm start

# testes
npm test
npm test -- --runInBand

# lint
npm run lint

# banco (Knex)
npm run migrate
npm run migrate:rollback
npm run seed:sqlite

# utilitários
npm run seed
npm run migrate:data
```

## Frontend (pasta irmã `../frontend`)

```bash
cd ..\frontend
npm install
npm start
npm run build
npm test
```

## Verificação rápida da API

```bash
# health
curl http://localhost:5000/api/health

# login
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@construcao.com\",\"senha\":\"admin123\"}"
```

## Upload de arquivo (exemplo)

```bash
curl -X POST http://localhost:5000/api/files/upload -H "Authorization: Bearer TOKEN" -F "file=@C:/temp/foto.jpg" -F "obra=1" -F "tipoArquivo=foto_obra" -F "descricao=Foto de acompanhamento"
```

## Logs (PowerShell)

```powershell
Get-Content .\logs\combined.log -Wait
Get-Content .\logs\error.log -Wait
```

## SQL útil (SQLite)

```powershell
sqlite3 .\data\database.sqlite ".tables"
sqlite3 .\data\database.sqlite "SELECT COUNT(*) FROM medicoes;"
sqlite3 .\data\database.sqlite "SELECT id,nome,status FROM obras LIMIT 20;"
```

## Troubleshooting

```powershell
# porta em uso
netstat -ano | findstr :5000

# encerrar processo
taskkill /PID <PID> /F

# reinstalar dependências
rmdir /s /q node_modules
npm install
```