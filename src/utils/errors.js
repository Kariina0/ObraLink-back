/**
 * Classe base para erros da aplicação
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Erro de validação (400)
 */
class ValidationError extends AppError {
  constructor(message = "Dados inválidos", details = []) {
    super(message, 400);
    this.details = details;
  }
}

/**
 * Erro de autenticação (401)
 */
class UnauthorizedError extends AppError {
  constructor(message = "Não autorizado") {
    super(message, 401);
  }
}

/**
 * Erro de permissão (403)
 */
class ForbiddenError extends AppError {
  constructor(message = "Acesso negado") {
    super(message, 403);
  }
}

/**
 * Erro de recurso não encontrado (404)
 */
class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado") {
    super(message, 404);
  }
}

/**
 * Erro de conflito (409)
 */
class ConflictError extends AppError {
  constructor(message = "Conflito de dados") {
    super(message, 409);
  }
}

/**
 * Erro interno do servidor (500)
 */
class InternalServerError extends AppError {
  constructor(message = "Erro interno do servidor") {
    super(message, 500);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError,
};
