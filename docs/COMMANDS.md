# 🛠️ Comandos Úteis

## 📦 NPM Scripts

```bash
# Desenvolvimento (com auto-reload)
npm run dev

# Produção
npm start

# Popular banco de dados com dados de exemplo
# Para MongoDB (legacy)
npm run seed

# Para SQLite (Knex)
npm run seed:sqlite

# Executar testes (quando implementados)
npm test

# Lint do código
npm run lint
```

## 🗄️ MongoDB

### Windows

```bash
# Iniciar MongoDB
net start MongoDB

# Parar MongoDB
net stop MongoDB

# Status do MongoDB
sc query MongoDB
```

### Linux/Mac

```bash
# Iniciar MongoDB
sudo systemctl start mongodb
# ou
sudo service mongodb start

# Parar MongoDB
sudo systemctl stop mongodb

# Status do MongoDB
sudo systemctl status mongodb

# Logs do MongoDB
sudo journalctl -u mongodb
```

### Mongo Shell

```bash
# Conectar ao MongoDB
mongosh

# Listar bancos de dados
show dbs

# Usar banco específico
use construcao_db

# Listar coleções
show collections

# Ver documentos de uma coleção
db.users.find().pretty()

# Contar documentos
db.users.countDocuments()

# Limpar coleção (CUIDADO!)
db.users.deleteMany({})

# Dropar banco de dados (CUIDADO!)
db.dropDatabase()
```

## 🗂️ SQLite / Knex

O projeto inclui suporte a SQLite via Knex.js. Use as migrações e seeds abaixo para preparar o banco local:

```bash
# Rodar migrações
npm run migrate

# Reverter migrações
npm run migrate:rollback

# Popular com seed sqlite
npm run seed:sqlite
```

Defina o cliente via variável de ambiente `DB_CLIENT=sqlite` (Windows PowerShell: `$env:DB_CLIENT="sqlite"`).

## 🧹 Limpeza

```bash
# Remover node_modules
rm -rf node_modules  # Linux/Mac
rmdir /s node_modules  # Windows

# Remover logs
rm -rf logs  # Linux/Mac
rmdir /s logs  # Windows

# Remover uploads
rm -rf uploads  # Linux/Mac
rmdir /s uploads  # Windows

# Reinstalar dependências
npm install

# Limpar cache do npm
npm cache clean --force
```

## 🔍 Debugging

### Ver logs em tempo real

```bash
# Linux/Mac
tail -f logs/combined.log
tail -f logs/error.log

# Windows PowerShell
Get-Content logs/combined.log -Wait
Get-Content logs/error.log -Wait
```

### Testar conexão MongoDB

```javascript
// Execute no mongo shell
mongosh
use construcao_db
db.runCommand({ ping: 1 })
```

### Ver processos na porta 5000

```bash
# Windows
netstat -ano | findstr :5000

# Linux/Mac
lsof -i :5000
```

### Matar processo na porta 5000

```bash
# Windows (use o PID do comando anterior)
taskkill /PID <PID> /F

# Linux/Mac
kill -9 $(lsof -t -i:5000)
```

## 📊 Queries Úteis do MongoDB

### Listar todos os usuários

```javascript
db.users.find({ "metadata.deletedAt": null }).pretty();
```

### Buscar usuário por email

```javascript
db.users.findOne({ email: "admin@construcao.com" });
```

### Listar obras ativas

```javascript
db.obras
  .find({
    status: "em_andamento",
    "metadata.deletedAt": null,
  })
  .pretty();
```

### Contar medições por obra

```javascript
db.medicaos.aggregate([
  { $match: { "metadata.deletedAt": null } },
  { $group: { _id: "$obra", total: { $sum: 1 } } },
]);
```

### Listar medições pendentes de sincronização

```javascript
db.medicaos
  .find({
    sincronizado: false,
    "metadata.deletedAt": null,
  })
  .pretty();
```

### Tamanho total de arquivos por obra

```javascript
db.arquivos.aggregate([
  { $match: { "metadata.deletedAt": null } },
  {
    $group: {
      _id: "$obra",
      totalSize: { $sum: "$tamanho" },
      totalFiles: { $sum: 1 },
    },
  },
]);
```

## 🧪 Testes Rápidos com cURL

### Health Check

```bash
curl http://localhost:5000/api/health
```

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@construcao.com","senha":"admin123"}'
```

### Listar medições (substitua TOKEN)

```bash
curl http://localhost:5000/api/measurements/minhas \
  -H "Authorization: Bearer TOKEN"
```

### Upload de arquivo

```bash
curl -X POST http://localhost:5000/api/files/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@caminho/para/arquivo.jpg" \
  -F "obra=OBRA_ID" \
  -F "tipo=foto_obra"
```

## 🔐 Gerar Novos Secrets

### JWT Secret

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64
```

## 📝 Git

```bash
# Inicializar repositório
git init

# Adicionar arquivos
git add .

# Commit
git commit -m "Initial commit: Sistema completo de construção civil"

# Adicionar remote
git remote add origin URL_DO_REPOSITORIO

# Push
git push -u origin main
```

## 🐳 Docker (Opcional)

### MongoDB com Docker

```bash
# Executar MongoDB
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:latest

# Ver logs
docker logs mongodb -f

# Parar
docker stop mongodb

# Iniciar novamente
docker start mongodb

# Remover container
docker rm mongodb

# Remover com volume
docker rm -v mongodb
```

### Criar Dockerfile para a aplicação

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

### Build e executar

```bash
# Build
docker build -t construcao-backend .

# Executar
docker run -d \
  --name construcao-api \
  -p 5000:5000 \
  --env-file .env \
  construcao-backend
```

## 📊 Monitoramento

### Ver uso de memória do Node

```bash
# Linux/Mac
ps aux | grep node

# Windows
tasklist | findstr node
```

### Ver uso de CPU

```bash
# Linux
top
# Pressione 'Shift+M' para ordenar por memória

# Windows
taskmgr
```

## 🔄 Backup e Restore

### Backup do MongoDB

```bash
# Backup completo
mongodump --db construcao_db --out ./backup

# Backup com compressão
mongodump --db construcao_db --gzip --archive=backup.gz
```

### Restore do MongoDB

```bash
# Restore de diretório
mongorestore --db construcao_db ./backup/construcao_db

# Restore de arquivo comprimido
mongorestore --db construcao_db --gzip --archive=backup.gz
```

## 🚀 Deploy

### PM2 (Process Manager)

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicação
pm2 start src/server.js --name construcao-api

# Ver status
pm2 status

# Ver logs
pm2 logs construcao-api

# Restart
pm2 restart construcao-api

# Stop
pm2 stop construcao-api

# Remover
pm2 delete construcao-api

# Salvar configuração
pm2 save

# Iniciar no boot
pm2 startup
```

## 📈 Performance

### Verificar pacotes desatualizados

```bash
npm outdated
```

### Atualizar pacotes

```bash
# Atualizar todos
npm update

# Atualizar específico
npm update express
```

### Análise de bundle

```bash
npm install -g npm-check
npm-check
```

---

**Dica**: Salve este arquivo para referência rápida durante o desenvolvimento!
