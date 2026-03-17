# Estrutura técnica do projeto ObraLink

> Atualizado em 17/03/2026 com base no código-fonte real.

---

## 1. Backend (`backend/`)

```
backend/
├── knexfile.js              # Configuração de ambientes do Knex (dev/test/prod)
├── package.json
├── eslint.config.js
├── data/                    # Arquivo SQLite gerado em runtime
├── docs/                    # Esta documentação
├── logs/                    # Logs gerados pelo Winston (combined + error)
├── migrations/              # Versões do schema do banco (ordem cronológica)
│   ├── 20260224_initial_schema.js
│   ├── 20260226_add_storage_fields.js
│   ├── 20260304_add_dimensoes_medicao.js
│   ├── 20260304_add_indexes.js
│   ├── 20260304_business_rules.js
│   ├── 20260306_add_password_reset_fields.js
│   ├── 20260310_remove_legacy_tables.js
│   └── 20260316_add_motivoRejeicao_medicoes.js
├── scripts/                 # Utilitários de seed e manutenção
│   ├── seed.js
│   ├── seed_sqlite.js
│   ├── seed_postgres.js
│   ├── fix_area_calculada.js
│   ├── migrate_data.js
│   ├── supabase_setup.sql
│   └── supabase_rls_auth.sql
├── src/
│   ├── app.js               # Configuração do Express (middlewares globais)
│   ├── server.js            # Entrada: inicia servidor e conexão com banco
│   ├── config/
│   │   ├── database.js      # Instância Knex e helpers de conexão
│   │   ├── jwt.js           # Configuração de segredos e TTLs do JWT
│   │   ├── multer.js        # Configuração de upload (destino, limites, filtros)
│   │   └── supabaseClient.js# Cliente Supabase (ativado se STORAGE_PROVIDER=supabase)
│   ├── constants/
│   │   └── index.js         # Constantes globais (enums, limites, mensagens)
│   ├── controllers/         # Camada HTTP: lê req, chama service, retorna DTO
│   │   ├── ArquivoController.js
│   │   ├── AuthController.js
│   │   ├── DiarioController.js
│   │   ├── MedicaoController.js
│   │   ├── ObraController.js
│   │   └── SyncController.js
│   ├── dtos/                # Objetos de transferência: molda a saída para o cliente
│   │   ├── ArquivoDTO.js
│   │   ├── DiarioDTO.js
│   │   ├── MedicaoDTO.js
│   │   ├── ObraDTO.js
│   │   └── UserDTO.js
│   ├── middleware/
│   │   ├── auth.js          # authenticate (JWT) e authorize (RBAC por perfil)
│   │   ├── errorHandler.js  # Tratamento centralizado de erros HTTP
│   │   └── validation.js    # Wrapper para aplicar schemas Joi nas rotas
│   ├── repositories/        # Acesso a dados — somente Knex, sem lógica de negócio
│   │   ├── BaseRepository.js
│   │   ├── ArquivoRepository.js
│   │   ├── DiarioRepository.js
│   │   ├── MedicaoRepository.js
│   │   ├── ObraRepository.js
│   │   ├── SolicitacaoCompraRepository.js
│   │   └── UserRepository.js
│   ├── routes/              # Define endpoints e aplica middlewares na ordem correta
│   │   ├── index.js         # Agrega todas as rotas sob /api
│   │   ├── auth.js
│   │   ├── diarios.js
│   │   ├── files.js
│   │   ├── management.js
│   │   ├── measurements.js
│   │   ├── obras.js
│   │   ├── solicitacoes.js
│   │   └── sync.js
│   ├── services/            # Regras de negócio e autorização de domínio
│   │   ├── ArquivoService.js
│   │   ├── AuthService.js
│   │   ├── DiarioService.js
│   │   ├── MedicaoService.js
│   │   ├── ObraService.js
│   │   ├── StorageService.js
│   │   └── SyncService.js
│   ├── utils/
│   │   ├── errors.js        # Classes de erros de domínio (AppError, NotFoundError…)
│   │   ├── fileTypeValidator.js # Validação por magic bytes
│   │   ├── helpers.js       # Funções utilitárias de resposta HTTP padronizada
│   │   └── logger.js        # Instância Winston configurada
│   └── validators/          # Schemas Joi por domínio
│       ├── arquivoValidator.js
│       ├── authValidator.js
│       ├── diarioValidator.js
│       ├── medicaoValidator.js
│       ├── obraValidator.js
│       └── syncValidator.js
└── tests/
    ├── helpers/
    │   ├── auth.js          # Funções utilitárias para autenticação em testes
    │   ├── database.js      # Setup/teardown do banco de teste
    │   └── fullDatabase.js  # Seed completo para testes de integração
    ├── integration/
    │   ├── auth.routes.test.js
    │   ├── files.routes.test.js
    │   ├── general.routes.test.js
    │   ├── seed_sqlite.test.js
    │   └── solicitacoes.routes.test.js
    └── unit/
        ├── ArquivoService.test.js
        └── StorageService.test.js
```

---

## 2. Frontend (`frontend/`)

```
frontend/
├── package.json
├── vercel.json              # Configuração de deploy na Vercel
├── public/                  # Assets estáticos e index.html
└── src/
    ├── App.jsx              # Definição de rotas e providers globais
    ├── index.js             # Entry point React
    ├── components/
    │   ├── ErrorBoundary.jsx  # Captura erros de renderização React
    │   ├── Icons.jsx          # Biblioteca de ícones SVG internos
    │   ├── Layout.jsx         # Estrutura visual com Navbar + Sidebar
    │   ├── Modal.jsx          # Componente de modal reutilizável
    │   ├── NavBar.jsx         # Barra de navegação superior
    │   ├── PrivateRoute.jsx   # Guarda de rota com verificação de perfil
    │   ├── Sidebar.jsx        # Menu lateral com controle de permissão
    │   └── SyncManager.jsx    # Componente background de sincronização
    ├── constants/             # Enums e constantes compartilhadas
    ├── context/
    │   └── AuthContext.js     # Sessão global: usuário, token, login/logout
    ├── hooks/
    │   └── useObras.js        # Hook para listagem e seleção de obras
    ├── pages/
    │   ├── Login.jsx          # Autenticação
    │   ├── Register.jsx       # Cadastro (só admin acessa)
    │   ├── Dashboard.jsx      # Tela inicial pós-login
    │   ├── Profile.jsx        # Dados do usuário e troca de senha
    │   ├── EnviarMedicao.jsx  # Formulário de criação de medição
    │   ├── measurements.jsx   # Listagem de medições (supervisor/admin)
    │   ├── DiarioObra.jsx     # Registro do diário diário de obra
    │   ├── PurchaseRequest.jsx# Criação de solicitação de compra
    │   ├── StatusSolicitacao.jsx # Acompanhamento de solicitações
    │   ├── Upload.jsx         # Upload de fotos e arquivos
    │   ├── GerenciarObras.jsx # CRUD de obras (supervisor/admin)
    │   ├── MeusRelatorios.jsx # Exportações e relatórios
    │   ├── AdminPanel.jsx     # Painel administrativo
    │   └── Sincronizacao.jsx  # Status e reprocessamento da fila offline
    ├── services/              # Integração com API do backend
    │   ├── api.js             # Instância Axios + interceptor de refresh token
    │   ├── authService.js
    │   ├── authRecoveryService.js
    │   ├── medicoesService.js
    │   ├── diariosService.js
    │   ├── purchasesService.js
    │   ├── filesService.js
    │   ├── obrasService.js
    │   ├── managementService.js
    │   ├── syncService.js
    │   ├── usersService.js
    │   └── response.js        # Helpers de resposta padronizada
    ├── styles/                # CSS global e por módulo
    └── utils/
        ├── db.js              # IndexedDB para arquivos pendentes de upload
        └── syncQueue.js       # Fila de sync offline com retry e TTL
```

---

## 3. Responsabilidade de cada camada (backend)

| Camada | Responsabilidade |
|--------|-----------------|
| `routes/` | Define endpoints; aplica `authenticate`, `authorize` e `validate` na ordem correta |
| `middleware/auth.js` | Verifica JWT (`authenticate`) e perfil mínimo (`authorize`) |
| `middleware/validation.js` | Executa schema Joi; rejeita request malformado antes do controller |
| `controllers/` | Lê `req`, chama o service, converte resultado para DTO e responde com helper HTTP |
| `services/` | Contém toda a lógica de negócio e regras de autorização de domínio |
| `repositories/` | Executa queries Knex; não conhece HTTP nem regras de negócio |
| `dtos/` | Molda o objeto de saída, mascarando campos sensíveis |
| `utils/errors.js` | Classes de erro de domínio que o `errorHandler` traduz em status HTTP |

---

## 4. Banco de dados — tabelas ativas

| Tabela | Propósito | Soft delete |
|--------|-----------|-------------|
| `users` | Usuários e credenciais | `deletedAt` (coluna) |
| `obras` | Cadastro de obras com código único | `deletedAt` (coluna) |
| `obra_encarregados` | Relação N:N obra ↔ usuário | — |
| `medicoes` | Boletins de medição com itens em JSON | `metadata.deletedAt` |
| `diarios` | Registros diários com atividades em JSON | `deletedAt` (coluna) |
| `solicitacoes_compra` | Pedidos de material com itens e valor calculado | `deletedAt` (coluna) |
| `arquivos` | Metadados de arquivos enviados | — |

---

## 5. Fluxo padrão de requisição

```
HTTP Request
    │
    ▼
app.js — CORS, Helmet, Compression, Rate Limit, Body Parser
    │
    ▼
routes/index.js — prefixo /api
    │
    ├── middleware/auth.js (authenticate — valida JWT)
    ├── middleware/auth.js (authorize — verifica perfil)
    ├── middleware/validation.js (Joi schema)
    │
    ▼
Controller — extrai parâmetros, chama service
    │
    ▼
Service — aplica regras de negócio e autorização de domínio
    │
    ▼
Repository — executa query Knex no SQLite
    │
    ▼
DTO — molda resposta (remove campos sensíveis)
    │
    ▼
helpers.js — resposta HTTP padronizada (success/error)
```

---

## 6. Variáveis de ambiente relevantes

| Variável | Exemplo | Descrição |
|----------|---------|-----------|
| `NODE_ENV` | `development` | Ambiente de execução |
| `PORT` | `5000` | Porta do servidor |
| `JWT_SECRET` | `<string forte>` | Segredo do access token |
| `JWT_REFRESH_SECRET` | `<string forte>` | Segredo do refresh token |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS whitelist |
| `STORAGE_PROVIDER` | `local` ou `supabase` | Provedor de arquivos |
| `UPLOAD_PATH` | `./uploads` | Diretório local de uploads |
| `MAX_FILE_SIZE` | `5242880` | Limite de arquivo em bytes (5 MB) |
| `ALLOWED_FILE_TYPES` | `image/jpeg,image/png,application/pdf` | MIME types permitidos |
| `IMAGE_COMPRESSION_QUALITY` | `80` | Qualidade de compressão Sharp (1-100) |
| `SUPABASE_URL` | `https://...` | URL do projeto Supabase (se aplicável) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Chave de serviço Supabase |
| `REACT_APP_API_URL` | `http://localhost:5000/api` | URL da API no frontend |
