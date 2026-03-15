# Instalação e execução

## Pré-requisitos

- Node.js `>=18`
- npm

## Backend (`Projeto-backend-master`)

### 1) Instalar dependências

```bash
npm install
```

### 2) Configurar ambiente

Crie/ajuste o arquivo `.env` com, no mínimo:

```env
NODE_ENV=development
PORT=5000

JWT_SECRET=defina_um_segredo_forte
JWT_REFRESH_SECRET=defina_outro_segredo_forte

ALLOWED_ORIGINS=http://localhost:3000

STORAGE_PROVIDER=local
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,application/pdf
IMAGE_COMPRESSION_QUALITY=80
```

Se usar Supabase para arquivos:

```env
STORAGE_PROVIDER=supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=obras-arquivos
```

### 3) Rodar migrations

```bash
npm run migrate
```

### 4) Popular dados de exemplo (opcional)

```bash
npm run seed:sqlite
```

### 5) Subir API

```bash
npm run dev
```

API: `http://localhost:5000/api`

## Frontend (opcional, pasta irmã `../frontend`)

```bash
cd ..\frontend
npm install
npm start
```

Defina `REACT_APP_API_URL` no frontend para apontar para o backend.

Exemplo:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

## Verificação rápida

### Health check

```bash
curl http://localhost:5000/api/health
```

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@construcao.com\",\"senha\":\"admin123\"}"
```

## Testes

```bash
npm test -- --runInBand
```

Estado validado em 15/03/2026: `7` suítes, `98` testes passando.
