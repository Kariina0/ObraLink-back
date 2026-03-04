const Joi = require("joi");
const { TIPOS_ARQUIVO_UPLOAD } = require("../constants");

/**
 * Validação de metadados do upload de arquivo.
 * Os campos são enviados como multipart/form-data junto com o arquivo.
 */
const uploadArquivoSchema = Joi.object({
  obra: Joi.number().integer().positive().required().messages({
    "number.base": "Obra deve ser um número inteiro",
    "any.required": "Obra é obrigatória",
  }),
  tipoArquivo: Joi.string()
    .valid(...TIPOS_ARQUIVO_UPLOAD)
    .required()
    .messages({
      "any.required": "Tipo do arquivo é obrigatório",
      "any.only": `Tipo do arquivo deve ser um dos seguintes: ${TIPOS_ARQUIVO_UPLOAD.join(", ")}`,
    }),
  descricao: Joi.string().trim().min(3).max(500).required().messages({
    "string.empty": "Descrição é obrigatória",
    "any.required": "Descrição é obrigatória",
    "string.min": "Descrição deve ter pelo menos 3 caracteres",
  }),
  detalheProblema: Joi.when("tipoArquivo", {
    is: "problema",
    then: Joi.string().trim().min(10).required().messages({
      "any.required": "Detalhe do problema é obrigatório quando o tipo é 'problema'",
      "string.min": "Detalhe do problema deve ter pelo menos 10 caracteres",
    }),
    otherwise: Joi.string().allow("", null),
  }),
  solicitadoPor: Joi.number().integer().positive().allow(null),
  tipo: Joi.string().allow("", null),        // tipo/pasta interna (legado)
  tags: Joi.string().allow("", null),
  coordenadas: Joi.string().allow("", null),
});

module.exports = { uploadArquivoSchema };
