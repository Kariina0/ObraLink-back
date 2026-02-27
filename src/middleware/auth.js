const jwtConfig = require("../config/jwt");
const { UnauthorizedError } = require("../utils/errors");
const userRepository = require("../repositories/UserRepository");

/**
 * Middleware de autenticação JWT
 */
const authenticate = async (req, res, next) => {
  try {
    // Extrair token do header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Token não fornecido");
    }

    const token = authHeader.substring(7);

    // Verificar token
    const decoded = jwtConfig.verifyAccessToken(token);

    // Buscar usuário
    const user = await userRepository.findById(decoded.id);

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Usuário não encontrado ou inativo");
    }

    // Adicionar usuário ao request
    req.user = {
      id: user.id || user._id,
      email: user.email,
      perfil: user.perfil,
      obraAtual: user.obraAtual || user.obra || null,
    };

    next();
  } catch (error) {
    // Erros JWT → 401. Erros de infraestrutura (banco, rede) → propagam como 500.
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError" ||
      error instanceof UnauthorizedError
    ) {
      return next(new UnauthorizedError("Token inválido ou expirado"));
    }
    return next(error);
  }
};

/**
 * Middleware de autorização por perfil
 */
const authorize = (...allowedPerfis) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("Usuário não autenticado"));
    }

    if (!allowedPerfis.includes(req.user.perfil)) {
      const { ForbiddenError } = require("../utils/errors");
      return next(
        new ForbiddenError("Você não tem permissão para acessar este recurso"),
      );
    }

    next();
  };
};

/**
 * Middleware opcional de autenticação
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = jwtConfig.verifyAccessToken(token);
      const user = await userRepository.findById(decoded.id);

      if (user && user.isActive) {
        req.user = {
          id: user.id || user._id,
          email: user.email,
          perfil: user.perfil,
          obraAtual: user.obraAtual || user.obra || null,
        };
      }
    }
  } catch (error) {
    // Ignorar erros no auth opcional
  }

  next();
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
};
