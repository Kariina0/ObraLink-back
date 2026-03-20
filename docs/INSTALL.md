# Instalação e execução local

Guia completo para subir o backend com configuração correta para o estado atual do código.

## Sumário

- [Pré-requisitos](#pré-requisitos)
- [Configuração rápida](#configuração-rápida)
- [Variáveis de ambiente obrigatórias](#variáveis-de-ambiente-obrigatórias)
- [Variáveis opcionais](#variáveis-opcionais)
- [Migrations e seeds](#migrations-e-seeds)
- [Subida da API](#subida-da-api)
- [Checklist de validação](#checklist-de-validação)

## Pré-requisitos

| Item | Requisito |
|---|---|
| Node.js | >= 18 |
| npm | >= 9 |
| Projeto Supabase | URL e service role key válidas |

## Configuração rápida

```bash
cd backend
npm install
```

Crie `.env` na raiz do backend.

## Variáveis de ambiente obrigatórias

> Estas variáveis são validadas em `src/utils/validateEnv.js` e bloqueiam o startup se ausentes.

```env
JWT_SECRET=seu_jwt_secret
JWT_REFRESH_SECRET=seu_jwt_refresh_secret
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

Obrigatória quando `STORAGE_PROVIDER=supabase`:

```env
SUPABASE_STORAGE_BUCKET=obras-arquivos
```

## Variáveis opcionais

```env
NODE_ENV=development
PORT=5000
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
RATE_LIMIT_MAX=100
LOGIN_RATE_LIMIT_MAX=10
REFRESH_RATE_LIMIT_MAX=30
FORGOT_PASSWORD_RATE_LIMIT_MAX=5
RESET_PASSWORD_RATE_LIMIT_MAX=8
RESET_PASSWORD_TTL_MINUTES=15

STORAGE_PROVIDER=local
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,application/pdf,image/heic,image/heif
IMAGE_COMPRESSION_QUALITY=80

EMAIL_HOST=
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=
```

## Migrations e seeds

```bash
npm run migrate
npm run seed:sqlite
```

Outros seeds:

```bash
npm run seed
npm run seed:postgres
npm run seed:supabase
```

Credenciais padrão de seed:

| Perfil | Email | Senha |
|---|---|---|
| Admin | `admin@construcao.com` | `admin123` |
| Supervisor | `supervisor@construcao.com` | `super123` |
| Encarregado | `encarregado@construcao.com` | `encar123` |

## Subida da API

```bash
npm run dev
```

Servidor: `http://localhost:5000`

API: `http://localhost:5000/api`

## Checklist de validação

1. `GET /health` retorna status ok.
2. `GET /api/health` retorna status ok e timestamp.
3. `POST /api/auth/login` retorna access e refresh token.
4. Log indica conexão com Supabase sem erro.

Referências:

- [COMMANDS.md](COMMANDS.md)
- [README.md](README.md)
- [REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md)
