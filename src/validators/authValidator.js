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
  senha: Joi.string()
    .required()
    .min(8)
    .pattern(/[A-Z]/, "maiúscula")
    .pattern(/[0-9]/, "número")
    .messages({
      "string.empty": "Senha é obrigatória",
      "string.min": "Senha deve ter pelo menos 8 caracteres",
      "string.pattern.name": "Senha deve conter ao menos uma letra maiúscula e um número",
    }),
  perfil: Joi.string()
    .valid(PERFIS.ENCARREGADO, PERFIS.SUPERVISOR)
    .default(PERFIS.ENCARREGADO)
    .messages({
      "any.only": "Perfil deve ser 'encarregado' ou 'supervisor'",
    }),
  obraAtual: Joi.number().integer().positive().allow(null),
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
  novaSenha: Joi.string()
    .required()
    .min(8)
    .pattern(/[A-Z]/, "maiúscula")
    .pattern(/[0-9]/, "número")
    .messages({
      "string.empty": "Nova senha é obrigatória",
      "string.min": "Nova senha deve ter pelo menos 8 caracteres",
      "string.pattern.name": "Senha deve conter ao menos uma letra maiúscula e um número",
    }),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().required().email().lowercase().trim().messages({
    "string.empty": "Email é obrigatório",
    "string.email": "Email inválido",
  }),
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().required().email().lowercase().trim().messages({
    "string.empty": "Email é obrigatório",
    "string.email": "Email inválido",
  }),
  codigo: Joi.string().required().pattern(/^\d{6}$/).messages({
    "string.empty": "Código é obrigatório",
    "string.pattern.base": "Código deve conter 6 dígitos",
  }),
  novaSenha: Joi.string()
    .required()
    .min(8)
    .pattern(/[A-Z]/, "maiúscula")
    .pattern(/[0-9]/, "número")
    .messages({
      "string.empty": "Nova senha é obrigatória",
      "string.min": "Nova senha deve ter pelo menos 8 caracteres",
      "string.pattern.name": "Senha deve conter ao menos uma letra maiúscula e um número",
    }),
  confirmarSenha: Joi.any().valid(Joi.ref("novaSenha")).required().messages({
    "any.only": "Confirmação de senha diferente da nova senha",
    "any.required": "Confirmação de senha é obrigatória",
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
