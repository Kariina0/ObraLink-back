# 📋 Documentação de Regras de Negócio - Sistema de Construção Civil

## 📑 Índice

1. [Visão Geral](#visão-geral)
2. [Autenticação e Autorização](#autenticação-e-autorização)
3. [Gestão de Usuários](#gestão-de-usuários)
4. [Gestão de Obras](#gestão-de-obras)
5. [Medições](#medições)
6. [Diários de Obra](#diários-de-obra)
7. [Solicitações de Compra](#solicitações-de-compra)
8. [Gestão de Arquivos](#gestão-de-arquivos)
9. [Sincronização Offline](#sincronização-offline)
10. [LGPD e Privacidade](#lgpd-e-privacidade)
11. [Segurança](#segurança)

---

## 🎯 Visão Geral

O sistema gerencia a comunicação e documentação em obras de construção civil, permitindo registro de medições, diários de obra, solicitações de compra e upload de arquivos, com suporte a operação offline.

### Objetivos do Sistema

- Centralizar comunicação entre equipes de obra
- Agilizar aprovação de medições e solicitações
- Manter histórico completo de atividades
- Permitir trabalho offline com sincronização posterior
- Garantir conformidade com LGPD

---

## 🔐 Autenticação e Autorização

### RN-001: Cadastro de Usuários

**Regra:** Todo usuário deve ter nome, email único e senha.

**Detalhes:**

- Email deve ser válido e único no sistema
- Senha deve ter no mínimo 6 caracteres
- Senha é armazenada com hash bcrypt (10 rounds)
- Nome é obrigatório e não pode ser vazio
- Perfil é obrigatório no cadastro

**Validações:**

```javascript
// Veja: src/validators/authValidator.js
{
  nome: Joi.string().required().min(3),
  email: Joi.string().email().required(),
  senha: Joi.string().required().min(6),
  perfil: Joi.string().valid('admin', 'supervisor', 'encarregado')
}
```

### RN-002: Sistema de Perfis (RBAC)

**Regra:** O sistema possui 3 níveis hierárquicos de acesso.

**Perfis:**

| Perfil          | Permissões                                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Encarregado** | - Criar próprias medições, diários e solicitações<br>- Visualizar medições próprias<br>- Editar medições em rascunho<br>- Upload de arquivos relacionados                                       |
| **Supervisor**  | - Todas as permissões do Encarregado<br>- Aprovar/rejeitar medições<br>- Aprovar/rejeitar solicitações de compra<br>- Visualizar medições de toda a obra<br>- Adicionar observações em medições |
| **Admin**       | - Todas as permissões do Supervisor<br>- Gerenciar usuários (criar, editar, excluir)<br>- Criar e gerenciar obras<br>- Visualizar uso de armazenamento<br>- Acesso total ao sistema             |

**Implementação:**

```javascript
// Veja: src/middleware/auth.js - authorize()
// Veja: src/constants/index.js - PERFIS
const PERFIS = {
  ADMIN: "admin",
  SUPERVISOR: "supervisor",
  ENCARREGADO: "encarregado",
};
```

### RN-003: Tokens JWT

**Regra:** Autenticação via JWT com Access Token e Refresh Token.

**Detalhes:**

- **Access Token**: Expira em 15 minutos, usado em todas as requisições
- **Refresh Token**: Expira em 7 dias, usado para renovar access token
- Tokens são gerados no login e registro
- Refresh token é armazenado no banco de dados
- Logout invalida o refresh token

**Fluxo:**

1. Login → Gera access + refresh tokens
2. Requisição → Valida access token
3. Token expirado → Usa refresh token para renovar
4. Refresh token expirado → Requer novo login

**Implementação:**

```javascript
// Veja: src/config/jwt.js
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### RN-004: Rate Limiting

**Regra:** Proteção contra ataques de força bruta.

**Detalhes:**

- Rotas de autenticação (`/api/auth/*`): máximo 100 requisições por 15 minutos
- Aplica-se por IP
- Retorna erro 429 (Too Many Requests) quando excedido

**Implementação:**

```javascript
// Veja: src/app.js
RATE_LIMIT_WINDOW_MS = 900000; // 15 minutos
RATE_LIMIT_MAX_REQUESTS = 100;
```

---

## 👥 Gestão de Usuários

### RN-005: Cadastro de Usuário

**Regra:** Apenas administradores podem cadastrar novos usuários.

**Exceções:**

- Endpoint `/api/auth/register` permite auto-registro (pode ser desabilitado em produção)

**Dados Obrigatórios:**

- Nome completo
- Email único
- Senha (min. 6 caracteres)
- Perfil (encarregado, supervisor, admin)

### RN-006: Soft Delete

**Regra:** Usuários nunca são deletados fisicamente do banco.

**Detalhes:**

- Ao "excluir", define `metadata.deletedAt` com timestamp
- Usuários deletados não aparecem em listagens
- Dados preservados para auditoria e LGPD
- Admin pode restaurar usuário removendo o campo `deletedAt`

**Implementação:**

```javascript
// Veja: src/repositories/BaseRepository.js - softDelete()
metadata.deletedAt = new Date();
```

### RN-007: Alteração de Senha

**Regra:** Usuário pode alterar própria senha fornecendo senha atual.

**Detalhes:**

- Senha atual deve ser validada
- Nova senha deve ter no mínimo 6 caracteres
- Nova senha é hasheada antes de salvar
- Todos os refresh tokens são invalidados (requer novo login)

---

## 🏗️ Gestão de Obras

### RN-008: Cadastro de Obras

**Regra:** Apenas administradores podem criar obras.

**Dados Obrigatórios:**

- Nome da obra
- Código único (ex: RES-001)
- Endereço completo
- Cliente (empresa/pessoa)
- Data de início
- Equipe responsável (array de usuários com funções)

**Dados Opcionais:**

- Data prevista de término
- Orçamento total
- Descrição
- Observações

**Implementação:**

```javascript
// Veja: src/models/Obra.js
{
  nome: { type: String, required: true },
  codigo: { type: String, required: true, unique: true },
  endereco: { /* objeto com endereço completo */ },
  cliente: { /* dados do cliente */ },
  equipe: [{ user, funcao, dataInclusao }],
  dataInicio: { type: Date, required: true }
}
```

### RN-009: Status de Obras

**Regra:** Obra possui ciclo de vida com status definidos.

**Status Possíveis:**

- `planejamento` - Obra em fase de planejamento
- `em_andamento` - Obra em execução
- `pausada` - Obra temporariamente suspensa
- `concluida` - Obra finalizada
- `cancelada` - Obra cancelada

**Transições Permitidas:**

- `planejamento` → `em_andamento`, `cancelada`
- `em_andamento` → `pausada`, `concluida`, `cancelada`
- `pausada` → `em_andamento`, `concluida`, `cancelada`
- `concluida` e `cancelada` → status final (não permite alterações)

### RN-010: Equipe da Obra

**Regra:** Obra deve ter equipe definida com funções específicas.

**Detalhes:**

- Cada membro tem função (ex: "Engenheiro", "Mestre de Obras")
- Data de inclusão é registrada automaticamente
- Apenas membros da equipe podem criar medições/diários
- Admin pode adicionar/remover membros a qualquer momento

### RN-011: Orçamento da Obra

**Regra:** Sistema controla valor orçado vs. valor gasto.

**Detalhes:**

- Orçamento inicial é definido na criação da obra
- `valorGasto` é atualizado automaticamente ao aprovar medições
- Sistema não bloqueia se exceder orçamento (apenas alerta)
- Relatórios mostram percentual de execução orçamentária

---

## 📊 Medições

### RN-012: Criação de Medição

**Regra:** Apenas membros da equipe da obra podem criar medições.

**Dados Obrigatórios:**

- Obra (referência)
- Data da medição
- Itens medidos (array com descrição, quantidade, unidade, valor unitário)

**Dados Opcionais:**

- Período (data início e fim)
- Observações
- Anexos (fotos, documentos)

**Validações:**

- Quantidade deve ser maior ou igual a zero
- Valor unitário deve ser maior que zero
- Unidade de medida deve estar na lista permitida

**Implementação:**

```javascript
// Veja: src/models/Medicao.js
{
  obra: { type: ObjectId, ref: 'Obra', required: true },
  responsavel: { type: ObjectId, ref: 'User', required: true },
  data: { type: Date, required: true },
  itens: [{
    descricao: String,
    quantidade: Number,
    unidade: String,  // m², m³, un, etc.
    valorUnitario: Number,
    valorTotal: Number  // calculado automaticamente
  }]
}
```

### RN-013: Cálculos Automáticos

**Regra:** Valores totais são calculados automaticamente.

**Fórmulas:**

- `valorTotal` do item = `quantidade` × `valorUnitario`
- `valorTotal` da medição = soma de todos os `valorTotal` dos itens
- Cálculos executados no backend antes de salvar

**Implementação:**

```javascript
// Veja: src/services/MedicaoService.js
itens.forEach((item) => {
  item.valorTotal = item.quantidade * item.valorUnitario;
});
```

### RN-014: Status de Medições

**Regra:** Medição possui fluxo de aprovação com status definidos.

**Status:**

- `rascunho` - Criada mas não enviada (pode ser editada)
- `enviada` - Aguardando aprovação (não pode ser editada)
- `aprovada` - Aprovada por supervisor/admin (não pode ser editada)
- `rejeitada` - Rejeitada por supervisor/admin (pode ser editada)

**Transições:**

```
rascunho → enviada → aprovada (fluxo normal)
                  ↘ rejeitada → enviada (reenvio após correção)
```

### RN-015: Aprovação de Medições

**Regra:** Apenas supervisores e admins podem aprovar/rejeitar medições.

**Detalhes:**

- Medição deve estar com status `enviada`
- Ao aprovar:
  - Status muda para `aprovada`
  - `valorGasto` da obra é incrementado
  - Data de aprovação é registrada
  - Aprovador é registrado
- Ao rejeitar:
  - Status muda para `rejeitada`
  - Motivo da rejeição deve ser informado
  - Encarregado pode corrigir e reenviar

**Implementação:**

```javascript
// Veja: src/controllers/MedicaoController.js - aprovar() e rejeitar()
```

### RN-016: Edição de Medições

**Regra:** Medição só pode ser editada em status específicos.

**Permissões:**

- `rascunho`: Criador pode editar livremente
- `rejeitada`: Criador pode editar e reenviar
- `enviada`: Não pode ser editada (apenas cancelada)
- `aprovada`: Não pode ser editada (somente admin pode reverter)

### RN-017: Exclusão de Medições

**Regra:** Medições são soft-deleted e seguem regras de permissão.

**Detalhes:**

- Criador pode excluir próprias medições em `rascunho` ou `rejeitada`
- Supervisor/Admin podem excluir qualquer medição não aprovada
- Medições aprovadas não podem ser excluídas (apenas admin pode fazer soft-delete)
- Exclusão define `metadata.deletedAt`

---

## 📝 Diários de Obra

### RN-018: Criação de Diário

**Regra:** Membros da equipe devem registrar diariamente atividades da obra.

**Dados Obrigatórios:**

- Obra (referência)
- Data do diário (único por obra/dia)
- Atividades executadas (array de strings)

**Dados Opcionais:**

- Condições climáticas
- Equipe presente (número de funcionários)
- Observações
- Fotos/anexos

**Implementação:**

```javascript
// Veja: src/models/Diario.js
{
  obra: { type: ObjectId, ref: 'Obra', required: true },
  data: { type: Date, required: true },
  atividades: [{ type: String, required: true }],
  clima: { type: String },
  equipePresenteNumero: { type: Number }
}
```

### RN-019: Diário Único por Data

**Regra:** Só pode existir um diário por obra por dia.

**Detalhes:**

- Sistema valida se já existe diário para aquela obra e data
- Se existir, deve editar o existente ao invés de criar novo
- Índice único no MongoDB garante integridade

**Implementação:**

```javascript
// Veja: src/models/Diario.js
schema.index({ obra: 1, data: 1 }, { unique: true });
```

### RN-020: Edição de Diários

**Regra:** Diários podem ser editados dentro do prazo permitido.

**Detalhes:**

- Criador pode editar diário até 7 dias após criação
- Após 7 dias, apenas admin pode editar
- Supervisor pode editar diários de sua obra
- Todas as edições são registradas em log

---

## 🛒 Solicitações de Compra

### RN-021: Criação de Solicitação

**Regra:** Membros da equipe podem solicitar compra de materiais/serviços.

**Dados Obrigatórios:**

- Obra (referência)
- Tipo (material ou serviço)
- Itens solicitados (descrição, quantidade, unidade, justificativa)

**Dados Opcionais:**

- Prioridade (baixa, média, alta, urgente)
- Data necessária
- Fornecedor sugerido
- Observações

**Implementação:**

```javascript
// Veja: src/models/SolicitacaoCompra.js
{
  obra: { type: ObjectId, ref: 'Obra', required: true },
  tipo: { type: String, enum: ['material', 'servico'] },
  itens: [{
    descricao: String,
    quantidade: Number,
    unidade: String,
    justificativa: String
  }],
  prioridade: { type: String, enum: ['baixa', 'media', 'alta', 'urgente'] }
}
```

### RN-022: Status de Solicitações

**Regra:** Solicitação possui fluxo de aprovação similar a medições.

**Status:**

- `pendente` - Aguardando análise
- `aprovada` - Aprovada para compra
- `rejeitada` - Negada com justificativa
- `concluida` - Compra realizada

**Transições:**

```
pendente → aprovada → concluida
        ↘ rejeitada
```

### RN-023: Aprovação de Solicitações

**Regra:** Apenas supervisores e admins podem aprovar solicitações.

**Detalhes:**

- Ao aprovar: muda status para `aprovada`, registra aprovador e data
- Ao rejeitar: muda status para `rejeitada`, registra motivo
- Solicitações aprovadas podem ter compra registrada (status `concluida`)

### RN-024: Priorização

**Regra:** Solicitações possuem níveis de prioridade.

**Níveis:**

- `urgente` - Necessário imediatamente (pode parar obra)
- `alta` - Necessário em até 3 dias
- `media` - Necessário em até 7 dias
- `baixa` - Pode aguardar planejamento

**Impacto:**

- Prioridade aparece em relatórios e dashboards
- Notificações são enviadas para prioridades `urgente` e `alta`

---

## 📁 Gestão de Arquivos

### RN-025: Upload de Arquivos

**Regra:** Usuários autenticados podem fazer upload de arquivos relacionados a obras.

**Tipos Permitidos:**

- Imagens: JPEG, PNG
- Documentos: PDF
- Tamanho máximo: 5 MB por arquivo

**Validações:**

- Arquivo deve estar relacionado a uma obra
- Tipo de arquivo deve ser especificado (foto_obra, medicao, diario, documento, outros)
- MIME type é validado no backend

**Implementação:**

```javascript
// Veja: src/config/multer.js
MAX_FILE_SIZE = 5242880; // 5 MB
((ALLOWED_FILE_TYPES = image / jpeg), image / png, application / pdf);
```

### RN-026: Processamento de Imagens

**Regra:** Imagens são automaticamente comprimidas para economizar espaço.

**Detalhes:**

- Biblioteca Sharp redimensiona e comprime
- Qualidade configurável (padrão: 80%)
- Mantém proporções originais
- Resolve orientação EXIF automaticamente
- Redimensiona para max. 1920x1080 se necessário

**Implementação:**

```javascript
// Veja: src/services/ArquivoService.js
IMAGE_COMPRESSION_QUALITY = 80;
```

### RN-027: Organização de Arquivos

**Regra:** Arquivos são organizados por tipo em diretórios separados.

**Estrutura:**

```
uploads/
├── foto_obra/       # Fotos gerais da obra
├── medicao/         # Documentos de medições
├── diario/          # Fotos de diários
├── documento/       # Documentos gerais
└── outros/          # Outros arquivos
```

### RN-028: Metadados de Arquivos

**Regra:** Sistema registra metadados completos de cada arquivo.

**Informações Armazenadas:**

- Nome original e nome no servidor
- Caminho e URL de acesso
- Tipo e MIME type
- Tamanho em bytes
- Dimensões (para imagens)
- Coordenadas GPS (se disponível nos EXIF)
- Tags para busca
- Obra relacionada
- Usuário que fez upload
- Data e hora do upload

**Implementação:**

```javascript
// Veja: src/models/Arquivo.js
```

### RN-029: Controle de Armazenamento

**Regra:** Sistema monitora uso de armazenamento por obra.

**Detalhes:**

- Admin pode consultar uso total e por obra
- Relatórios mostram:
  - Total de arquivos
  - Tamanho total em MB/GB
  - Arquivos por tipo
  - Maiores arquivos
- Alertas quando limite é atingido (configurável)

**Implementação:**

```javascript
// Veja: src/controllers/ArquivoController.js - getStorageUsage()
```

### RN-030: Exclusão de Arquivos

**Regra:** Exclusão de arquivos é soft-delete com limpeza posterior.

**Detalhes:**

- Soft-delete: marca `metadata.deletedAt`
- Arquivo físico permanece temporariamente
- Cronjob limpa arquivos marcados há mais de 30 dias
- Admin pode restaurar arquivo antes da limpeza física
- Apenas criador, supervisor da obra ou admin podem excluir

---

## 🔄 Sincronização Offline

### RN-031: Suporte a Operação Offline

**Regra:** App mobile pode operar sem conexão e sincronizar depois.

**Detalhes:**

- Cliente armazena dados localmente (SQLite, AsyncStorage)
- Ao reconectar, envia dados para API
- Servidor processa e resolve conflitos
- Cliente recebe confirmação e atualiza dados locais

### RN-032: Estratégia Last-Write-Wins

**Regra:** Em caso de conflito, última modificação vence.

**Implementação:**

- Cada registro tem `clientTimestamp` (data de modificação no cliente)
- Servidor compara com `metadata.updatedAt` do banco
- Se `clientTimestamp` > `updatedAt`, aceita atualização
- Se `clientTimestamp` < `updatedAt`, rejeita e retorna versão do servidor

**Exemplo:**

```javascript
// Veja: src/services/SyncService.js
if (clientTimestamp > serverTimestamp) {
  // Aceita atualização do cliente
  await update(data);
} else {
  // Rejeita e retorna versão mais recente
  return { conflict: true, serverData: current };
}
```

### RN-033: Identificadores de Sincronização

**Regra:** Registros criados offline têm ID temporário.

**Detalhes:**

- Cliente gera UUID para novos registros
- Campo `syncId` armazena este UUID
- Servidor cria registro com novo `_id` do MongoDB
- Retorna mapeamento `syncId` → `_id` para cliente atualizar
- Cliente substitui ID temporário pelo definitivo

**Implementação:**

```javascript
// Veja: src/models/Medicao.js
{
  syncId: { type: String, unique: true, sparse: true }
}
```

### RN-034: Sincronização Incremental

**Regra:** Cliente solicita apenas dados modificados desde última sync.

**Detalhes:**

- Cliente envia `lastSyncDate` (timestamp da última sincronização)
- Servidor retorna apenas registros criados ou modificados após essa data
- Reduz tráfego de dados significativamente

**Endpoint:**

```javascript
GET /api/sync/pending?lastSyncDate=2024-01-01T00:00:00Z
// Retorna: { medicoes: [...], diarios: [...], arquivos: [...] }
```

### RN-035: Retry e Resiliência

**Regra:** Sistema tenta reenviar dados automaticamente em caso de falha.

**Detalhes:**

- Cliente tenta 3 vezes com delay exponencial (1s, 2s, 4s)
- Se falhar, marca para retry posterior
- Usuário é notificado sobre falhas
- Configurável via variáveis de ambiente

**Implementação:**

```javascript
SYNC_RETRY_ATTEMPTS = 3;
SYNC_RETRY_DELAY = 1000; // ms
```

---

## 🔒 LGPD e Privacidade

### RN-036: Soft Delete Global

**Regra:** Nenhum dado pessoal é deletado fisicamente do banco.

**Detalhes:**

- Todos os modelos implementam soft-delete
- Campo `metadata.deletedAt` marca exclusão
- Dados permanecem para auditoria e compliance
- Queries filtram registros deletados automaticamente

**Implementação:**

```javascript
// Veja: src/repositories/BaseRepository.js
async find(filter = {}) {
  return this.model.find({
    ...filter,
    'metadata.deletedAt': null
  });
}
```

### RN-037: Consentimento de Uso

**Regra:** Sistema registra consentimento do usuário ao se cadastrar.

**Detalhes:**

- Checkbox de aceite dos termos é obrigatório
- Data de consentimento é armazenada
- Usuário pode revogar consentimento (leva ao soft-delete)

### RN-038: Direito ao Esquecimento

**Regra:** Usuário pode solicitar remoção de seus dados.

**Processo:**

1. Usuário solicita exclusão via admin
2. Admin marca usuário como deletado (soft-delete)
3. Após 30 dias, script remove dados sensíveis (email, etc.)
4. Mantém apenas ID e referências para integridade relacional

### RN-039: Anonimização

**Regra:** Dados podem ser anonimizados para análises.

**Detalhes:**

- Remove informações identificáveis (nome, email, CPF)
- Mantém dados agregados para estatísticas
- Usado em relatórios e dashboards

### RN-040: Auditoria de Acesso

**Regra:** Sistema registra todos os acessos a dados sensíveis.

**Logs Incluem:**

- Quem acessou
- Quando acessou
- Qual dado foi acessado
- IP de origem
- Ação realizada (leitura, escrita, exclusão)

**Implementação:**

```javascript
// Veja: src/utils/logger.js - Winston
logger.info("User accessed sensitive data", {
  userId: user.id,
  action: "read",
  resource: "User",
  resourceId: targetUser.id,
  ip: req.ip,
});
```

---

## 🛡️ Segurança

### RN-041: Validação de Entrada

**Regra:** Todos os dados de entrada são validados antes do processamento.

**Detalhes:**

- Validação com Joi em todas as rotas
- Schema específico para cada endpoint
- Mensagens de erro personalizadas em português
- Validação de tipos, formatos e ranges

**Implementação:**

```javascript
// Veja: src/validators/authValidator.js
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email inválido",
    "any.required": "Email é obrigatório",
  }),
  senha: Joi.string().required().min(6),
});
```

### RN-042: Sanitização de Dados

**Regra:** Dados são sanitizados para prevenir injeção de código.

**Detalhes:**

- Mongoose previne NoSQL Injection por padrão
- Strings são trimadas (removem espaços)
- HTML é escapado em campos de texto livre
- Uploads são validados por MIME type real (não apenas extensão)

### RN-043: Headers de Segurança

**Regra:** Helmet adiciona headers de segurança HTTP.

**Headers Configurados:**

- `X-Frame-Options`: Previne clickjacking
- `X-Content-Type-Options`: Previne MIME sniffing
- `X-XSS-Protection`: Previne XSS
- `Strict-Transport-Security`: Força HTTPS
- `Content-Security-Policy`: Controla recursos carregados

**Implementação:**

```javascript
// Veja: src/app.js
app.use(helmet());
```

### RN-044: CORS Configurável

**Regra:** CORS é configurado para permitir apenas origens confiáveis.

**Detalhes:**

- Lista de origens permitidas via variável de ambiente
- Produção: apenas domínio do frontend
- Desenvolvimento: `http://localhost:3000`
- Credenciais (cookies) permitidas

**Implementação:**

```javascript
CORS_ORIGIN=http://localhost:3000
// Produção: https://app.construcao.com
```

### RN-045: Proteção de Senhas

**Regra:** Senhas são sempre hasheadas e nunca retornadas em respostas.

**Detalhes:**

- Bcrypt com 10 rounds de salt
- Senha nunca aparece em logs
- DTOs removem campo senha das respostas
- Comparação de senha usa método seguro do bcrypt

**Implementação:**

```javascript
// Veja: src/models/User.js
userSchema.pre("save", async function (next) {
  if (this.isModified("senha")) {
    this.senha = await bcrypt.hash(this.senha, 10);
  }
  next();
});
```

### RN-046: Proteção contra Enumeração

**Regra:** Mensagens de erro não revelam se email existe.

**Detalhes:**

- Login inválido: "Email ou senha inválidos" (não especifica qual)
- Registro duplicado: erro genérico
- Previne atacantes de descobrir emails válidos

### RN-047: Logs de Segurança

**Regra:** Eventos de segurança são logados para auditoria.

**Eventos Logados:**

- Tentativas de login (sucesso e falha)
- Criação/modificação/exclusão de usuários
- Alterações de senha
- Tentativas de acesso não autorizado
- Rate limiting atingido
- Erros de validação suspeitos

**Implementação:**

```javascript
// Veja: src/utils/logger.js
logs/error.log       # Apenas erros
logs/combined.log    # Todos os logs
```

### RN-048: Timeout de Sessão

**Regra:** Access tokens expiram em 15 minutos.

**Detalhes:**

- Força renovação periódica via refresh token
- Reduz janela de exposição em caso de token roubado
- Refresh token expira em 7 dias
- Logout invalida refresh token imediatamente

---

## 📈 Regras de Cálculo e Métricas

### RN-049: Cálculo de Valor Total de Medição

**Fórmula:**

```javascript
valorTotal = Σ (quantidade[i] × valorUnitario[i])
```

**Exemplo:**

```javascript
Item 1: 10 m³ × R$ 350,00 = R$ 3.500,00
Item 2: 50 m² × R$ 80,00  = R$ 4.000,00
Total da medição         = R$ 7.500,00
```

### RN-050: Atualização de Orçamento

**Regra:** Ao aprovar medição, atualiza valor gasto da obra.

**Detalhes:**

```javascript
obra.orcamento.valorGasto += medicao.valorTotal;
percentualGasto = (valorGasto / valorOrcado) × 100;
```

### RN-051: Progresso da Obra

**Fórmula:**

```javascript
dias_decorridos = hoje - dataInicio
dias_previstos = dataPrevisaoTermino - dataInicio
percentual_tempo = (dias_decorridos / dias_previstos) × 100
```

**Indicadores:**

- `percentual_tempo` > `percentualGasto` → Obra atrasada financeiramente
- `percentual_tempo` < `percentualGasto` → Obra adiantada financeiramente

---

## 🎯 Validações Específicas

### RN-052: Validação de Unidades de Medida

**Regra:** Apenas unidades padrão são aceitas.

**Unidades Permitidas:**

```javascript
// Veja: src/constants/index.js - UNIDADES_MEDIDA
const UNIDADES_MEDIDA = {
  METRO_QUADRADO: "m²",
  METRO_CUBICO: "m³",
  METRO_LINEAR: "m",
  UNIDADE: "un",
  QUILOGRAMA: "kg",
  TONELADA: "t",
  LITRO: "l",
  HORA: "h",
  DIA: "dia",
  VERBA: "vb",
};
```

### RN-053: Validação de Endereço

**Regra:** Endereço completo é obrigatório para obras.

**Campos Obrigatórios:**

- Logradouro (rua)
- Número
- Bairro
- Cidade
- Estado (sigla UF)
- CEP (formato: 00000-000)

**Campos Opcionais:**

- Complemento

### RN-054: Validação de Coordenadas GPS

**Regra:** Se fornecidas, coordenadas devem estar no formato válido.

**Validações:**

- Latitude: -90 a +90
- Longitude: -180 a +180
- Formato decimal (ex: -23.5505, -46.6333)

---

## 🔔 Notificações e Alertas

### RN-055: Notificação de Medição Pendente

**Regra:** Supervisor recebe alerta de medições pendentes há mais de 3 dias.

### RN-056: Alerta de Orçamento

**Regra:** Admin é notificado quando obra atinge 80% do orçamento.

### RN-057: Alerta de Prazo

**Regra:** Equipe é notificada quando faltam 30 dias para data prevista de término.

---

## 📊 Relatórios

### RN-058: Relatório de Medições

**Conteúdo:**

- Total de medições por período
- Valor total medido
- Status de aprovação
- Tempo médio de aprovação

### RN-059: Relatório de Progresso

**Conteúdo:**

- Percentual de execução física
- Percentual de execução financeira
- Curva ABC de gastos
- Projeção de conclusão

---

## 📝 Observações Finais

Esta documentação reflete as regras de negócio implementadas no sistema conforme os arquivos do projeto backend.

Para implementação técnica detalhada, consulte os arquivos correspondentes no repositório.

---

**Desenvolvido com ❤️ seguindo as melhores práticas de desenvolvimento e compliance com LGPD**
