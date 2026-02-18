const Joi = require("joi");
const { PERFIS } = require("../constants");

const registerSchema = Joi.object({
  nome: Joi.string().required().trim().min(3).max(100).messages({
    "string.empty": "Nome é obrigatório",
    "string.min": "Nome deve ter pelo menos 3 caracteres",
  }),
  email: Joi.string().required().email().lowercase().trim().messages({
    "string.empty": "Email é obrigatório",
    "string.email": "Email inválido",
  }),
  senha: Joi.string().required().min(6).messages({
    "string.empty": "Senha é obrigatória",
    "string.min": "Senha deve ter pelo menos 6 caracteres",
  }),
  perfil: Joi.string()
    .valid(...Object.values(PERFIS))
    .default(PERFIS.ENCARREGADO),
  obraAtual: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .allow(null),
});

const loginSchema = Joi.object({
  email: Joi.string().required().email().messages({
    "string.empty": "Email é obrigatório",
    "string.email": "Email inválido",
  }),
  senha: Joi.string().required().messages({
    "string.empty": "Senha é obrigatória",
  }),
});

const changePasswordSchema = Joi.object({
  senhaAtual: Joi.string().required().messages({
    "string.empty": "Senha atual é obrigatória",
  }),
  novaSenha: Joi.string().required().min(6).messages({
    "string.empty": "Nova senha é obrigatória",
    "string.min": "Nova senha deve ter pelo menos 6 caracteres",
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
};
