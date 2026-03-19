# Comandos operacionais

> Referência rápida de comandos para desenvolvimento, banco de dados e diagnóstico.

---

## Backend — scripts npm

```bash
# Iniciar em modo desenvolvimento (recarrega ao salvar)
npm run dev

# Iniciar em modo produção
npm start

# Executar todos os testes (recomendado: em série)
npm test -- --runInBand

# Executar testes com cobertura
npm test -- --coverage --runInBand

# Verificar lint
npm run lint

# Banco de dados — Knex
npm run migrate           # Aplica migrations pendentes
npm run migrate:rollback  # Reverte a última migration
npm run seed:sqlite       # Seed com dados de exemplo (SQLite)
npm run seed:postgres     # Seed com dados de exemplo (PostgreSQL)
npm run seed:supabase     # Seed completo no Supabase + upload de fotos reais (imagens/ ou frontend/static)
npm run seed              # Seed genérico
```

---

## Frontend — scripts npm

```bash
cd ..\frontend

npm install          # Instalar dependências
npm start            # Servidor de desenvolvimento (http://localhost:3000)
npm run build        # Build de produção (gera pasta build/)
npm test             # Testes unitários
```

---

## Requisições de teste com curl

```bash
# Health check
curl http://localhost:5000/api/health

# Login
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@construcao.com\",\"senha\":\"admin123\"}"

# Upload de arquivo (substitua TOKEN pelo access token retornado no login)
curl -X POST http://localhost:5000/api/files/upload ^
  -H "Authorization: Bearer TOKEN" ^
  -F "file=@C:/temp/foto.jpg" ^
  -F "obra=1" ^
  -F "tipoArquivo=foto_obra" ^
  -F "descricao=Foto de acompanhamento"

# Listar medicoes
curl http://localhost:5000/api/measurements ^
  -H "Authorization: Bearer TOKEN"
```

---

## Logs (PowerShell)

```powershell
# Acompanhar log combinado em tempo real
Get-Content .\logs\combined.log -Wait

# Acompanhar apenas erros
Get-Content .\logs\error.log -Wait

# Ultimas 50 linhas do log combinado
Get-Content .\logs\combined.log -Tail 50
```

---

## SQL util — SQLite

```powershell
# Listar todas as tabelas
sqlite3 .\data\database.sqlite ".tables"

# Contagem de registros
sqlite3 .\data\database.sqlite "SELECT COUNT(*) FROM medicoes;"
sqlite3 .\data\database.sqlite "SELECT COUNT(*) FROM users;"

# Listar obras ativas
sqlite3 .\data\database.sqlite "SELECT id, nome, status FROM obras WHERE deletedAt IS NULL LIMIT 20;"

# Listar usuarios
sqlite3 .\data\database.sqlite "SELECT id, nome, email, perfil FROM users WHERE deletedAt IS NULL;"

# Verificar pendencias de sync
sqlite3 .\data\database.sqlite "SELECT id, syncId, status FROM medicoes WHERE syncId IS NOT NULL LIMIT 20;"
```

---

## Troubleshooting

### Porta 5000 em uso

```powershell
# Identificar o processo
netstat -ano | findstr :5000

# Encerrar pelo PID retornado
taskkill /PID <PID> /F
```

### Dependencias corrompidas

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

### Banco com dados inconsistentes (dev)

```powershell
# Remover banco e recriar do zero
Remove-Item .\data\database.sqlite
npm run migrate
npm run seed:sqlite
```

### Rollback de migration

```bash
npm run migrate:rollback  # desfaz a ultima migration
```

### Variavel de ambiente nao carregada

Verifique se o arquivo `.env` esta na raiz do backend (mesmo nivel de `package.json`) e se foi criado com base no `.env.example`.