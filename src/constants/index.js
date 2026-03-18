/**
 * Perfis de usuário
 */
const PERFIS = {
  ADMIN: "admin",
  SUPERVISOR: "supervisor",
  ENCARREGADO: "encarregado",
};

/**
 * Status de solicitação de compra
 */
const STATUS_SOLICITACAO = {
  PENDENTE: "pendente",
  APROVADA: "aprovada",
  REJEITADA: "rejeitada",
  CONCLUIDA: "concluida",
};

/**
 * Tipos de arquivo (classificação interna)
 */
const TIPOS_ARQUIVO = {
  FOTO_OBRA: "foto_obra",
  MEDICAO: "medicao",
  DIARIO: "diario",
  DOCUMENTO: "documento",
  OUTROS: "outros",
};

/**
 * Tipos de upload de arquivo (campo tipoArquivo na tabela arquivos)
 */
const TIPOS_ARQUIVO_UPLOAD = [
  "solicitacao",
  "problema",
  "relatorio",
  "medicao",
  "foto_obra",
  "documento",
  "outros",
];

/**
 * Status de obra
 */
const STATUS_OBRA = {
  PLANEJAMENTO: "planejamento",
  EM_ANDAMENTO: "em_andamento",
  PAUSADA: "pausada",
  PARALISADA: "paralisada",
  CONCLUIDA: "concluida",
  CANCELADA: "cancelada",
};

/**
 * Tipos de serviço de medição
 */
const TIPOS_SERVICO = [
  "alvenaria",
  "pintura",
  "revestimento",
  "instalacao_eletrica",
  "instalacao_hidraulica",
  "impermeabilizacao",
  "estrutura",
  "cobertura",
  "acabamento",
  "demolicao",
  "escavacao",
  "outros",
];

/**
 * Unidades de medida válidas
 */
const UNIDADES_MEDIDA = ["m", "m²", "m³", "kg", "un", "t", "l"];

/**
 * Status de sincronização
 */
const STATUS_SYNC = {
  PENDENTE: "pendente",
  SINCRONIZADO: "sincronizado",
  ERRO: "erro",
  CONFLITO: "conflito",
};

/**
 * Códigos de erro
 */
const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SYNC_ERROR: "SYNC_ERROR",
};

/**
 * Mensagens padrão
 */
const MESSAGES = {
  SUCCESS: {
    CREATED: "Registro criado com sucesso",
    UPDATED: "Registro atualizado com sucesso",
    DELETED: "Registro excluído com sucesso",
    SYNCED: "Sincronização realizada com sucesso",
  },
  ERROR: {
    NOT_FOUND: "Registro não encontrado",
    INVALID_DATA: "Dados inválidos",
    UNAUTHORIZED: "Acesso não autorizado",
    FORBIDDEN: "Você não tem permissão para esta ação",
    INTERNAL: "Erro interno do servidor",
    SYNC_FAILED: "Falha na sincronização",
  },
};

/**
 * Configurações de paginação
 */
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};

/**
 * Configurações de upload
 */
const UPLOAD = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: [
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
    "application/pdf",
  ],
  IMAGE_QUALITY: 80,
};

module.exports = {
  PERFIS,
  STATUS_SOLICITACAO,
  TIPOS_ARQUIVO,
  TIPOS_ARQUIVO_UPLOAD,
  STATUS_OBRA,
  TIPOS_SERVICO,
  UNIDADES_MEDIDA,
  STATUS_SYNC,
  ERROR_CODES,
  MESSAGES,
  PAGINATION,
  UPLOAD,
};
