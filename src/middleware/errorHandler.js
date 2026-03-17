const logger = require("../utils/logger");
const { errorResponse } = require("../utils/helpers");
const { ERROR_CODES } = require("../constants");
const multer = require("multer");

/**
 * Middleware de tratamento de erros
 */
const errorHandler = (err, req, res, _next) => {
  // ── Erros do Multer ────────────────────────────────────────────────────────
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json(
        errorResponse(ERROR_CODES.VALIDATION_ERROR, "Arquivo muito grande. Tamanho máximo permitido é 5 MB.", [], 413),
      );
    }
    return res.status(400).json(
      errorResponse(ERROR_CODES.VALIDATION_ERROR, err.message, [], 400),
    );
  }

  // Erro genérico do filtro de tipo (lançado pelo fileFilter via cb(new Error(...)))
  if (err && err.message && err.message.startsWith("Tipo de arquivo não permitido")) {
    return res.status(400).json(
      errorResponse(ERROR_CODES.VALIDATION_ERROR, err.message, [], 400),
    );
  }
  // Log do erro
  if (!err.statusCode || err.statusCode >= 500) {
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
