const Joi = require("joi");

const CLIMAS_VALIDOS = [
  "ensolarado",
  "nublado",
  "chuvoso",
  "ventania",
  "instavel",
];

/** Schema de item genérico (atividade, ocorrência, etc.) */
const itemSchema = Joi.object({
  descricao: Joi.string().trim().required().messages({
    "string.empty": "Descrição do item é obrigatória",
    "any.required": "Descrição do item é obrigatória",
  }),
  quantidade: Joi.number().min(0).allow(null),
  unidade: Joi.string().allow("", null),
  observacoes: Joi.string().allow("", null),
});

const createDiarioSchema = Joi.object({
  obra: Joi.number().integer().positive().required().messages({
    "number.base": "ID de obra deve ser um número inteiro",
    "number.integer": "ID de obra inválido",
    "any.required": "Obra é obrigatória",
  }),
  data: Joi.date().default(() => new Date()).messages({
    "date.base": "Data inválida",
  }),
  clima: Joi.string()
    .valid(...CLIMAS_VALIDOS)
    .allow("", null)
    .messages({
      "any.only": `Clima deve ser um dos seguintes: ${CLIMAS_VALIDOS.join(", ")}`,
    }),
  atividades: Joi.array().items(itemSchema).min(1).required().messages({
    "array.min": "Pelo menos uma atividade é obrigatória",
    "any.required": "Atividades são obrigatórias",
  }),
  equipamentos: Joi.array().items(itemSchema).default([]),
  maoDeObra:    Joi.array().items(itemSchema).default([]),
  materiais:    Joi.array().items(itemSchema).default([]),
  ocorrencias:  Joi.array().items(itemSchema).default([]),
  visitantes:   Joi.array().items(itemSchema).default([]),
  fotos:        Joi.array().items(Joi.number().integer().positive()).default([]),
  observacoesGerais: Joi.string().allow("", null),
  syncId:       Joi.string().allow(null),
  clientTimestamp: Joi.date(),
});

const updateDiarioSchema = Joi.object({
  data:          Joi.date(),
  clima:         Joi.string().valid(...CLIMAS_VALIDOS).allow("", null),
  atividades:    Joi.array().items(itemSchema).min(1),
  equipamentos:  Joi.array().items(itemSchema),
  maoDeObra:     Joi.array().items(itemSchema),
  materiais:     Joi.array().items(itemSchema),
  ocorrencias:   Joi.array().items(itemSchema),
  visitantes:    Joi.array().items(itemSchema),
  fotos:         Joi.array().items(Joi.number().integer().positive()),
  observacoesGerais: Joi.string().allow("", null),
  clientTimestamp: Joi.date(),
});

module.exports = {
  createDiarioSchema,
  updateDiarioSchema,
};
