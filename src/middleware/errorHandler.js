const logger = require("../utils/logger");
const { AppError } = require("../utils/errors");
const { errorResponse } = require("../utils/helpers");
const { ERROR_CODES } = require("../constants");

/**
 * Middleware de tratamento de erros
 */
const errorHandler = (err, req, res, next) => {
  // Log do erro
  if (err.statusCode >= 500) {
    logger.error("Erro interno:", {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      user: req.user?.id,
    });
  } else {
    logger.warn("Erro do cliente:", {
      message: err.message,
      url: req.url,
      method: req.method,
      user: req.user?.id,
    });
  }

  // Erro operacional (esperado)
  if (err.isOperational) {
    return res
      .status(err.statusCode)
      .json(
        errorResponse(
          getErrorCode(err.statusCode),
          err.message,
          err.details || [],
          err.statusCode,
        ),
      );
  }

  // Erro do Mongoose - Validação
  if (err.name === "ValidationError") {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));

    return res
      .status(400)
      .json(
        errorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          "Erro de validação",
          details,
          400,
        ),
      );
  }

  // Erro do Mongoose - Cast (ID inválido)
  if (err.name === "CastError") {
    return res
      .status(400)
      .json(
        errorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          "ID inválido",
          [{ field: err.path, message: "Formato de ID inválido" }],
          400,
        ),
      );
  }

  // Erro do Mongoose - Duplicado
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res
      .status(409)
      .json(
        errorResponse(
          ERROR_CODES.CONFLICT,
          "Registro duplicado",
          [{ field, message: `${field} já existe` }],
          409,
        ),
      );
  }

  // Erro do JWT
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res
      .status(401)
      .json(
        errorResponse(
          ERROR_CODES.UNAUTHORIZED,
          "Token inválido ou expirado",
          [],
          401,
        ),
      );
  }

  // Erro inesperado
  return res
    .status(500)
    .json(
      errorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        process.env.NODE_ENV === "production"
          ? "Erro interno do servidor"
          : err.message,
        process.env.NODE_ENV === "production" ? [] : [{ stack: err.stack }],
        500,
      ),
    );
};

/**
 * Middleware para rotas não encontradas
 */
const notFound = (req, res, next) => {
  const { NotFoundError } = require("../utils/errors");
  next(new NotFoundError(`Rota ${req.originalUrl} não encontrada`));
};

/**
 * Helper para obter código de erro
 */
function getErrorCode(statusCode) {
  const codeMap = {
    400: ERROR_CODES.VALIDATION_ERROR,
    401: ERROR_CODES.UNAUTHORIZED,
    403: ERROR_CODES.FORBIDDEN,
    404: ERROR_CODES.NOT_FOUND,
    409: ERROR_CODES.CONFLICT,
    500: ERROR_CODES.INTERNAL_ERROR,
  };

  return codeMap[statusCode] || ERROR_CODES.INTERNAL_ERROR;
}

/**
 * Wrapper assíncrono para controllers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
};
