const Joi = require("joi");

const objectItem = Joi.object().unknown(true);

const createDiarioSchema = Joi.object({
  obra: Joi.number().integer().positive().required().messages({
    "number.base": "ID de obra deve ser um número inteiro",
    "number.integer": "ID de obra inválido",
    "any.required": "Obra é obrigatória",
  }),
  data: Joi.date().default(() => new Date()),
  clima: Joi.string().trim().max(80).allow("", null),
  equipamentos: Joi.alternatives().try(Joi.array().items(objectItem), objectItem, Joi.string()).allow(null),
  maoDeObra: Joi.alternatives().try(Joi.array().items(objectItem), objectItem, Joi.string()).allow(null),
  atividades: Joi.alternatives().try(Joi.array().items(objectItem), objectItem, Joi.string()).allow(null),
  materiais: Joi.alternatives().try(Joi.array().items(objectItem), objectItem, Joi.string()).allow(null),
  ocorrencias: Joi.array().items(objectItem).default([]),
  visitantes: Joi.array().items(objectItem).default([]),
  fotos: Joi.array().items(objectItem).default([]),
  observacoesGerais: Joi.string().allow("", null),
  assinatura: Joi.string().allow("", null),
  syncId: Joi.string().allow(null),
  clientTimestamp: Joi.date(),
});

const updateDiarioSchema = Joi.object({
  obra: Joi.number().integer().positive(),
  data: Joi.date(),
  clima: Joi.string().trim().max(80).allow("", null),
  equipamentos: Joi.alternatives().try(Joi.array().items(objectItem), objectItem, Joi.string()).allow(null),
  maoDeObra: Joi.alternatives().try(Joi.array().items(objectItem), objectItem, Joi.string()).allow(null),
  atividades: Joi.alternatives().try(Joi.array().items(objectItem), objectItem, Joi.string()).allow(null),
  materiais: Joi.alternatives().try(Joi.array().items(objectItem), objectItem, Joi.string()).allow(null),
  ocorrencias: Joi.array().items(objectItem),
  visitantes: Joi.array().items(objectItem),
  fotos: Joi.array().items(objectItem),
  observacoesGerais: Joi.string().allow("", null),
  assinatura: Joi.string().allow("", null),
  sincronizado: Joi.boolean(),
  clientTimestamp: Joi.date(),
});

module.exports = {
  createDiarioSchema,
  updateDiarioSchema,
};
