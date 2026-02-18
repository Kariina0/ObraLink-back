# 🚀 Guia Rápido de Instalação

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js v18+** ([Download](https://nodejs.org/))
- **MongoDB 7.0+** ([Download](https://www.mongodb.com/try/download/community))
- **npm** (incluído com Node.js) ou **yarn**
- **Git** (opcional, para clonar o repositório)
- **4GB RAM** mínimo
- **500MB** de espaço em disco

## Instalação Rápida

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar ambiente

O arquivo `.env` já está configurado para desenvolvimento. Se precisar ajustar:

```bash
# Edite o arquivo .env com suas configurações
```

### 3. Iniciar MongoDB

**Windows:**

```bash
# Abra o Prompt de Comando como Administrador
net start MongoDB
```

**Linux/Mac:**

```bash
sudo systemctl start mongodb
# ou
sudo service mongodb start
```

**Docker (alternativa):**

```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 4. Popular banco de dados (opcional)

```bash
npm run seed
```

Isso criará:

- 4 usuários de teste (admin, supervisor, 2 encarregados)
- 3 obras de exemplo

**Credenciais criadas:**

- Admin: `admin@construcao.com` / `admin123`
- Supervisor: `supervisor@construcao.com` / `supervisor123`
- Encarregado 1: `joao@construcao.com` / `encarregado123`
- Encarregado 2: `pedro@construcao.com` / `encarregado123`

### 5. Iniciar servidor

**Desenvolvimento (com auto-reload):**

```bash
npm run dev
```

**Produção:**

```bash
npm start
```

Servidor rodará em: `http://localhost:5000`

## ✅ Verificar Instalação

### Teste 1: Health Check

Abra o navegador ou use curl:

```bash
curl http://localhost:5000/api/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00Z",
  "uptime": 123,
  "environment": "development"
}
```

### Teste 2: Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@construcao.com",
    "senha": "admin123"
  }'
```

## 📁 Estrutura de Diretórios

Após a instalação, a estrutura será:

```
backend/
├── logs/                # Logs da aplicação
├── node_modules/        # Dependências
├── scripts/            # Scripts utilitários
├── src/                # Código fonte
│   ├── config/         # Configurações
│   ├── constants/      # Constantes
│   ├── controllers/    # Controllers
│   ├── dtos/          # DTOs
│   ├── middleware/    # Middlewares
│   ├── models/        # Models Mongoose
│   ├── repositories/  # Repositórios
│   ├── routes/        # Rotas
│   ├── services/      # Serviços
│   ├── utils/         # Utilitários
│   ├── validators/    # Validadores
│   ├── app.js         # App Express
│   └── server.js      # Servidor
├── uploads/           # Arquivos enviados
├── .env              # Variáveis de ambiente
├── .env.example      # Exemplo de variáveis
├── .gitignore        # Git ignore
├── api-examples.http # Exemplos de requisições
├── package.json      # Dependências e scripts
└── README.md         # Documentação completa
```

## 🧪 Testando a API

### Opção 1: VS Code REST Client

1. Instale a extensão "REST Client" no VS Code
2. Abra o arquivo `api-examples.http`
3. Clique em "Send Request" acima de cada requisição

### Opção 2: Postman/Insomnia

1. Importe as requisições do arquivo `api-examples.http`
2. Configure a variável `baseUrl`: `http://localhost:5000/api`
3. Execute as requisições

### Opção 3: cURL (linha de comando)

Veja exemplos no arquivo `api-examples.http`

## ❌ Troubleshooting

### Erro: "Cannot connect to MongoDB"

**Solução:**

```bash
# Verifique se MongoDB está rodando
# Windows
net start MongoDB

# Linux/Mac
sudo systemctl status mongodb
```

### Erro: "Port 5000 already in use"

**Solução:**

```bash
# Altere a porta no arquivo .env
PORT=3000
```

### Erro: "Cannot find module"

**Solução:**

```bash
# Reinstale as dependências
rm -rf node_modules
npm install
```

### Erro ao fazer upload de arquivos

**Solução:**

```bash
# Crie o diretório de uploads manualmente
mkdir uploads
```

### Logs não estão sendo salvos

**Solução:**

```bash
# Crie o diretório de logs
mkdir logs
```

## 📝 Próximos Passos

1. ✅ Servidor rodando
2. 📖 Leia o [README.md](README.md) completo
3. 🧪 Teste os endpoints usando `api-examples.http`
4. 🔐 Configure suas próprias credenciais em produção
5. 🚀 Desenvolva o frontend que consumirá esta API

## 🆘 Precisa de Ajuda?

- Documentação completa: [README.md](README.md)
- Exemplos de API: [api-examples.http](api-examples.http)
- Logs: `logs/combined.log` e `logs/error.log`

## 🎉 Pronto!

Seu backend está rodando! Acesse:

- API: http://localhost:5000
- Health Check: http://localhost:5000/api/health
- Documentação: http://localhost:5000 (redireciona para health)

---

**Desenvolvido para o SENAI - Projeto Sistema de Construção Civil**
