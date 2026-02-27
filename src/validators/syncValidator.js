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

const pendingQuerySchema = Joi.object({
  lastSyncDate: Joi.date(),
});

const pushBatchSchema = Joi.object({
  medicoes: Joi.array().items(syncItemBase).default([]),
  diarios: Joi.array().items(syncItemBase).default([]),
  solicitacoes: Joi.array().items(syncItemBase).default([]),
});

const conflictsSchema = Joi.object({
  medicoes: Joi.array().items(syncItemBase).default([]),
});

module.exports = {
  pendingQuerySchema,
  pushBatchSchema,
  conflictsSchema,
};
