const Joi = require("joi");
const { UNIDADES_MEDIDA } = require("../constants");

const medicaoItemSchema = Joi.object({
  descricao: Joi.string().required().trim().messages({
    "string.empty": "Descrição do item é obrigatória",
  }),
  quantidade: Joi.number().required().min(0).messages({
    "number.base": "Quantidade deve ser um número",
    "number.min": "Quantidade não pode ser negativa",
  }),
  unidade: Joi.string()
    .required()
    .valid(...UNIDADES_MEDIDA)
    .messages({
      "string.empty": "Unidade é obrigatória",
      "any.only": `Unidade deve ser uma das seguintes: ${UNIDADES_MEDIDA.join(", ")}`,
    }),
  valorUnitario: Joi.number().min(0).allow(null),
  valorTotal: Joi.number().min(0).allow(null),
  observacoes: Joi.string().allow(""),
  local: Joi.string().allow(""),
});

const createMedicaoSchema = Joi.object({
  obra: Joi.string()
    .required()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.empty": "Obra é obrigatória",
      "string.pattern.base": "ID de obra inválido",
    }),
  data: Joi.date().default(() => new Date()),
  periodo: Joi.object({
    inicio: Joi.date(),
    fim: Joi.date(),
  }),
  itens: Joi.array().items(medicaoItemSchema).min(1).required().messages({
    "array.min": "Pelo menos um item é obrigatório",
  }),
  anexos: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/)),
  observacoes: Joi.string().allow(""),
  status: Joi.string()
    .valid("rascunho", "enviada", "aprovada", "rejeitada")
    .default("rascunho"),
  syncId: Joi.string().allow(null),
  clientTimestamp: Joi.date(),
});

const updateMedicaoSchema = Joi.object({
  data: Joi.date(),
  periodo: Joi.object({
    inicio: Joi.date(),
    fim: Joi.date(),
  }),
  itens: Joi.array().items(medicaoItemSchema).min(1),
  anexos: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/)),
  observacoes: Joi.string().allow(""),
  status: Joi.string().valid("rascunho", "enviada", "aprovada", "rejeitada"),
  clientTimestamp: Joi.date(),
});

module.exports = {
  createMedicaoSchema,
  updateMedicaoSchema,
};
