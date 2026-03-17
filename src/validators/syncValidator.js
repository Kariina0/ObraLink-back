const Joi = require("joi");

const syncItemBase = Joi.object({
  syncId: Joi.string().required().messages({
    "string.empty": "syncId é obrigatório",
    "any.required": "syncId é obrigatório",
  }),
  clientTimestamp: Joi.date().required().messages({
    "date.base": "clientTimestamp inválido",
    "any.required": "clientTimestamp é obrigatório",
  }),
}).unknown(true);

const MAX_SYNC_LIMIT = parseInt(process.env.SYNC_BATCH_LIMIT_MAX) || 500;

const pendingQuerySchema = Joi.object({
  lastSyncDate: Joi.date(),
  limit: Joi.number().integer().min(1).max(MAX_SYNC_LIMIT).default(
    parseInt(process.env.SYNC_BATCH_LIMIT) || 100
  ),
  page: Joi.number().integer().min(1).default(1),
});

const arquivoSyncItem = Joi.object({
  syncId: Joi.string().required(),
  clientTimestamp: Joi.date().required(),
  obra: Joi.number().integer().positive().required(),
  base64: Joi.string().required(),
  mimeType: Joi.string().valid("image/jpeg", "image/png", "application/pdf").required(),
  originalname: Joi.string().default("arquivo"),
  tipo: Joi.string().default("foto_obra"),
  tipoArquivo: Joi.string().required(),
  descricao: Joi.string().default("Enviado offline"),
  coordenadas: Joi.object().allow(null),
  tags: Joi.string().allow("", null),
}).unknown(true);

const pushBatchSchema = Joi.object({
  medicoes: Joi.array().items(syncItemBase).default([]),
  diarios: Joi.array().items(syncItemBase).default([]),
  solicitacoes: Joi.array().items(syncItemBase).default([]),
  arquivos: Joi.array().items(arquivoSyncItem).max(
    parseInt(process.env.SYNC_MAX_FILES_PER_BATCH) || 20
  ).default([]),
});

const conflictsSchema = Joi.object({
  medicoes: Joi.array().items(syncItemBase).default([]),
});

module.exports = {
  pendingQuerySchema,
  pushBatchSchema,
  conflictsSchema,
};
