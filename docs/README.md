# Sistema de Comunicação Ágil para Construção Civil - Backend

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0+-green.svg)](https://www.mongodb.com/)
[![Express](https://img.shields.io/badge/Express-4.18-blue.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production_Ready-success.svg)]()

Sistema backend completo desenvolvido em Node.js e MongoDB para otimização de comunicação em obras da construção civil, com suporte a sincronização offline e gestão de medições, diários de obra e solicitações de compra.

## 📋 Índice

- [Características](#características)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Execução](#execução)
- [API Endpoints](#api-endpoints)
- [Sincronização Offline](#sincronização-offline)
- [LGPD](#lgpd)
- [Exemplos de Uso](#exemplos-de-uso)

## ✨ Características

- ✅ **Autenticação JWT** com refresh tokens
- ✅ **RBAC** (Role-Based Access Control) - Admin, Supervisor, Encarregado
- ✅ **Sincronização Offline** com resolução de conflitos (Last-Write-Wins)
- ✅ **Upload de Arquivos** com compressão automática de imagens
- ✅ **Paginação** e filtros dinâmicos
- ✅ **Soft Delete** para compliance LGPD
- ✅ **Rate Limiting** e segurança com Helmet
- ✅ **Logs estruturados** com Winston
- ✅ **Validação** com Joi
- ✅ **Arquitetura limpa** (MVC + Services + Repositories)

## 🛠 Tecnologias

- **Node.js** v18+
- **Express** - Framework web
- **MongoDB** - Banco de dados NoSQL
- **Mongoose** - ODM para MongoDB
- **JWT** - Autenticação
- **Multer** - Upload de arquivos
- **Sharp** - Processamento de imagens
- **Joi** - Validação de dados
- **Winston** - Logging
- **Bcryptjs** - Hash de senhas

## 🏗 Arquitetura

```
src/
├── config/          # Configurações (DB, JWT, Multer)
├── constants/       # Constantes do sistema
├── controllers/     # Controllers REST
├── dtos/           # Data Transfer Objects
├── middleware/      # Middlewares (Auth, Validation, Errors)
├── models/         # Schemas Mongoose
├── repositories/   # Camada de acesso a dados
├── routes/         # Definição de rotas
├── services/       # Lógica de negócio
├── utils/          # Helpers e utilitários
├── validators/     # Schemas de validação Joi
├── app.js          # Configuração do Express
└── server.js       # Ponto de entrada
```

### Padrões Implementados

- **MVC Pattern** - Separação de responsabilidades
- **Repository Pattern** - Abstração do banco de dados
- **Service Layer** - Lógica de negócio isolada
- **DTO Pattern** - Formatação de respostas
- **Middleware Pattern** - Interceptadores

## 📦 Instalação

```bash
# Clonar repositório
cd backend

# Instalar dependências
npm install
```

## ⚙️ Configuração

### 1. Criar arquivo .env

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

### 2. Configurar variáveis de ambiente

```env
# Ambiente
NODE_ENV=development

# Servidor
PORT=5000

# Banco de Dados
MONGODB_URI=mongodb://localhost:27017/construcao_db

# JWT
JWT_SECRET=seu_secreto_super_seguro_aqui
JWT_REFRESH_SECRET=outro_secreto_para_refresh_token
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Upload de Arquivos
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf
IMAGE_COMPRESSION_QUALITY=80

# Sincronização
SYNC_RETRY_ATTEMPTS=3
SYNC_RETRY_DELAY=1000

# Logs
LOG_LEVEL=info

# CORS
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Instalar MongoDB

Certifique-se de que o MongoDB está instalado e rodando:

```bash
# Windows (com MongoDB instalado)
mongod

# Linux/Mac
sudo systemctl start mongodb
```

## 🚀 Execução

### Desenvolvimento

```bash
npm run dev
```

### Produção

```bash
npm start
```

O servidor estará disponível em `http://localhost:5000`

## 📡 API Endpoints

### Base URL

```
http://localhost:5000/api
```

### Autenticação

#### Registrar Usuário

```http
POST /api/auth/register
Content-Type: application/json

{
  "nome": "João Silva",
  "email": "joao@exemplo.com",
  "senha": "senha123",
  "perfil": "encarregado"
}
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "nome": "João Silva",
      "email": "joao@exemplo.com",
      "perfil": "encarregado"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  },
  "message": "Usuário registrado com sucesso"
}
```

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "joao@exemplo.com",
  "senha": "senha123"
}
```

#### Renovar Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Logout

```http
POST /api/auth/logout
Authorization: Bearer {accessToken}
```

#### Obter Usuário Atual

```http
GET /api/auth/me
Authorization: Bearer {accessToken}
```

### Medições

#### Criar Medição

```http
POST /api/measurements
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "obra": "507f1f77bcf86cd799439011",
  "data": "2024-01-15T10:00:00Z",
  "itens": [
    {
      "descricao": "Concreto",
      "quantidade": 10,
      "unidade": "m³",
      "valorUnitario": 350.00
    },
    {
      "descricao": "Alvenaria",
      "quantidade": 50,
      "unidade": "m²",
      "valorUnitario": 80.00
    }
  ],
  "observacoes": "Medição mensal"
}
```

#### Listar Medições de uma Obra

```bash
GET /api/measurements/obra/{obraId}?page=1&limit=10
Authorization: Bearer {accessToken}
```

#### Listar Minhas Medições

```bash
GET /api/measurements/minhas?page=1&limit=10
Authorization: Bearer {accessToken}
```

#### Obter Medição por ID

```bash
GET /api/measurements/{id}
Authorization: Bearer {accessToken}
```

#### Atualizar Medição

```bash
PUT /api/measurements/{id}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "observacoes": "Observação atualizada",
  "status": "enviada"
}
```

#### Aprovar Medição (Supervisor/Admin)

```bash
POST /api/measurements/{id}/aprovar
Authorization: Bearer {accessToken}
```

#### Rejeitar Medição (Supervisor/Admin)

```bash
POST /api/measurements/{id}/rejeitar
Authorization: Bearer {accessToken}
```

#### Excluir Medição

```bash
DELETE /api/measurements/{id}
Authorization: Bearer {accessToken}
```

### Arquivos

#### Upload de Arquivo Único

```http
POST /api/files/upload
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data

file: [arquivo]
obra: "507f1f77bcf86cd799439011"
tipo: "foto_obra"
descricao: "Foto da fundação"
tags: "fundacao, inicio"
```

#### Upload de Múltiplos Arquivos

```http
POST /api/files/upload-multiple
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data

files: [arquivo1, arquivo2, arquivo3]
obra: "507f1f77bcf86cd799439011"
tipo: "medicao"
```

#### Listar Arquivos de uma Obra

```bash
GET /api/files/obra/{obraId}?page=1&limit=10
Authorization: Bearer {accessToken}
```

#### Listar Arquivos por Tipo

```bash
GET /api/files/tipo/{tipo}?page=1&limit=10
Authorization: Bearer {accessToken}
```

#### Obter Uso de Armazenamento (Admin)

```bash
GET /api/files/storage/usage?obraId={obraId}
Authorization: Bearer {accessToken}
```

#### Excluir Arquivo

```bash
DELETE /api/files/{id}
Authorization: Bearer {accessToken}
```

### Sincronização

#### Obter Dados Pendentes

```bash
GET /api/sync/pending?lastSyncDate=2024-01-01T00:00:00Z
Authorization: Bearer {accessToken}
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "medicoes": [...],
    "diarios": [...],
    "solicitacoes": [...],
    "arquivos": [...],
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```
