# Instalação e execução

> Guia para rodar o ObraLink (backend + frontend) em ambiente local.

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|------------|---------------|
| Node.js | `>=18` |
| npm | incluído no Node.js |

---

## Backend

### 1. Instalar dependências

```bash
cd backend
npm install
```

### 2. Configurar variáveis de ambiente

Copie o arquivo de exemplo e edite os valores:

```bash
copy .env.example .env
```

Configurações mínimas para desenvolvimento:

```env
NODE_ENV=development
PORT=5000

# JWT — use strings longas e aleatórias em produção
JWT_SECRET=defina_um_segredo_forte
JWT_REFRESH_SECRET=defina_outro_segredo_forte

# CORS — origem do frontend
ALLOWED_ORIGINS=http://localhost:3000

# Armazenamento de arquivos
STORAGE_PROVIDER=local
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,application/pdf
IMAGE_COMPRESSION_QUALITY=80
```

**Para usar Supabase como storage**, adicione também:

```env
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://<projeto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<sua-chave-service-role>
SUPABASE_STORAGE_BUCKET=obras-arquivos
```

### 3. Criar/atualizar o banco de dados

```bash
npm run migrate
```

Isso aplica todas as migrations em ordem cronológica e cria o arquivo SQLite em `data/`.

### 4. Popular com dados de exemplo (opcional)

```bash
npm run seed:sqlite
```

Cria usuários de teste, obras e dados iniciais para validação local.

Para ambiente Supabase (PostgreSQL + Storage), use:

```bash
npm run seed:supabase
```

Esse seed completo inclui upload de fotos reais (`foto-obra*.jpg`) para o bucket configurado,
criando registros em `arquivos` e vinculando os IDs nas medições e diários.

**Credenciais criadas pelo seed:**

| Usuário | Email | Senha | Perfil |
|---------|-------|-------|--------|
| Administrador | `admin@construcao.com` | `admin123` | `admin` |
| Supervisor | `supervisor@construcao.com` | `super123` | `supervisor` |
| Encarregado | `encarregado@construcao.com` | `encar123` | `encarregado` |

### 5. Iniciar o servidor

```bash
npm run dev
```

API disponível em: `http://localhost:5000/api`

---

## Frontend

```bash
cd ..\frontend
npm install
```

Crie o arquivo `.env` na raiz do frontend:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

Inicie o servidor de desenvolvimento:

```bash
npm start
```

Frontend disponível em: `http://localhost:3000`

---

## Verificação rápida

### Health check da API

```bash
curl http://localhost:5000/api/health
```

Resposta esperada:
```json
{ "status": "ok" }
```

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@construcao.com\",\"senha\":\"admin123\"}"
```

---

## Testes automatizados

```bash
npm test -- --runInBand
```

Estado validado em 15/03/2026: **7 suítes**, **98 testes** passando (~25 s).

> `--runInBand` é necessário para evitar conflitos de banco em testes de integração.

---

## Dicas de produção

- Defina `NODE_ENV=production` para desativar logs de debug e ativar compressão.
- Use variáveis de ambiente reais — nunca commite o `.env`.
- Configure um proxy reverso (Nginx / Caddy) na frente do Express para TLS.
- Para PostgreSQL em produção, configure `DATABASE_CLIENT=pg` e `DATABASE_URL` no `.env`.