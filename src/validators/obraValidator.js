const Joi = require("joi");
const { STATUS_OBRA } = require("../constants");

const STATUS_OBRA_VALUES = Object.values(STATUS_OBRA);

// Validação cruzada de datas reutilizável
const dataPrevisaoTerminoField = Joi.date()
  .when("dataInicio", {
    is: Joi.date().required(),
    then: Joi.date()
      .min(Joi.ref("dataInicio"))
      .allow(null)
      .messages({
        "date.min": "A previsão de término deve ser igual ou posterior à data de início",
      }),
    otherwise: Joi.date().allow(null),
  });

const createObraSchema = Joi.object({
  nome: Joi.string().trim().min(3).max(200).required().messages({
    "string.empty": "Nome da obra é obrigatório",
    "any.required": "Nome da obra é obrigatório",
  }),
  codigo: Joi.string().trim().max(50).allow("", null),
  cliente: Joi.string().trim().max(200).allow("", null),
  endereco: Joi.string().trim().allow("", null),
  coordenadas: Joi.string().allow("", null),
  dataInicio: Joi.date().allow(null),
  dataPrevisaoTermino: dataPrevisaoTerminoField,
  status: Joi.string()
    .valid(...STATUS_OBRA_VALUES)
    .default("planejamento"),
  descricao: Joi.string().allow("", null),
  observacoes: Joi.string().allow("", null),
  orcamento: Joi.object().allow(null),
  // Encarregados a vincular na criação
  encarregados: Joi.array().items(
    Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.object({
        userId: Joi.number().integer().positive().required(),
        funcao: Joi.string().allow("", null),
      })
    )
  ).optional(),
  syncId: Joi.string().allow(null),
});

const updateObraSchema = Joi.object({
  nome: Joi.string().trim().min(3).max(200),
  codigo: Joi.string().trim().max(50).allow("", null),
  cliente: Joi.string().trim().max(200).allow("", null),
  endereco: Joi.string().trim().allow("", null),
  coordenadas: Joi.string().allow("", null),
  dataInicio: Joi.date().allow(null),
  dataPrevisaoTermino: dataPrevisaoTerminoField,
  dataTermino: Joi.date().allow(null),
  status: Joi.string().valid(...STATUS_OBRA_VALUES),
  descricao: Joi.string().allow("", null),
  observacoes: Joi.string().allow("", null),
  orcamento: Joi.object().allow(null),
});

const vincularEncarregadoSchema = Joi.object({
  userId: Joi.number().integer().positive().required().messages({
    "any.required": "userId do encarregado é obrigatório",
  }),
  funcao: Joi.string().trim().allow("", null),
});

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...STATUS_OBRA_VALUES)
    .required()
    .messages({
      "any.required": "Status é obrigatório",
      "any.only": `Status deve ser um dos valores: ${STATUS_OBRA_VALUES.join(", ")}`,
    }),
  dataTermino: Joi.date().allow(null),
});

module.exports = {
  createObraSchema,
  updateObraSchema,
  vincularEncarregadoSchema,
  updateStatusSchema,
};
