const { createUserClient } = require("../config/supabaseClient");
const { UnauthorizedError } = require("../utils/errors");
const userRepository = require("../repositories/UserRepository");

// Permite período de transição com JWTs legados (custom) ainda em circulação.
// Quando AUTH_PROVIDER=supabase (padrão), verifica pelo Supabase Auth.
// Quando AUTH_PROVIDER=legacy, usa verificação JWT customizada (transitório).
const AUTH_PROVIDER = (process.env.AUTH_PROVIDER || "supabase").toLowerCase();

/**
 * Middleware de autenticação — Supabase Auth.
 *
 * Fluxo:
 *  1. Extrai Bearer token do header Authorization.
 *  2. Valida o JWT via supabase.auth.getUser(token) (verificado pelos servidores Supabase).
 *  3. Carrega o perfil do usuário em public.users (perfil, obraAtual, isActive).
 *  4. Popula req.user com { id, authId, email, perfil, obraAtual }.
 *
 * Compatibilidade de transição:
 *  Se AUTH_PROVIDER=legacy, delega para autenticação JWT customizada.
 */
const authenticate = async (req, res, next) => {
  // ── Modo legado (transitório) ─────────────────────────────────────────────
  if (AUTH_PROVIDER === "legacy") {
    return _authenticateLegacy(req, res, next);
  }

  // ── Modo Supabase Auth (padrão) ───────────────────────────────────────────
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Token não fornecido");
    }

    const token = authHeader.substring(7);

    // Valida token contra os servidores Supabase
    const userClient = createUserClient(token);
    const {
      data: { user: authUser },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !authUser) {
      throw new UnauthorizedError("Token inválido ou expirado");
    }

    // Carrega perfil em public.users pelo auth_id (UUID do Supabase) ou email
    let profile = null;
    try {
      profile = await userRepository.findByAuthId(authUser.id);
    } catch (_) {
      // Fallback: usuário criado antes da migração — busca por email
      try {
        profile = await userRepository.findByEmail(authUser.email);
      } catch (_2) {
        profile = null;
      }
    }

    if (!profile || !profile.isActive) {
      throw new UnauthorizedError("Usuário não encontrado ou inativo");
    }

    req.user = {
      id: profile.id,
      authId: authUser.id,          // UUID do auth.users no Supabase
      email: profile.email,
      perfil: profile.perfil,
      obraAtual: profile.obraAtual ?? null,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return next(error);
    }
    // Erros de rede/Supabase → 401 (não vaza detalhes internos)
    const msg = error?.message ?? "";
    if (
      msg.includes("JWT") ||
      msg.includes("token") ||
      msg.includes("unauthorized") ||
      msg.includes("invalid")
    ) {
      return next(new UnauthorizedError("Token inválido ou expirado"));
    }
    return next(error);
  }
};

/**
 * Middleware de autorização por perfil (RBAC).
 * Independente do provedor de autenticação.
 * @param {...string} allowedPerfis
 */
const authorize = (...allowedPerfis) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("Usuário não autenticado"));
    }

    if (!allowedPerfis.includes(req.user.perfil)) {
      const { ForbiddenError } = require("../utils/errors");
      return next(
        new ForbiddenError("Você não tem permissão para acessar este recurso")
      );
    }

    next();
  };
};

/**
 * Autenticação opcional — não retorna 401 se o token for inválido ou ausente.
 * Popula req.user se o token for válido.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      if (AUTH_PROVIDER === "legacy") {
        await _optionalLegacy(req, token);
      } else {
        const userClient = createUserClient(token);
        const {
          data: { user: authUser },
          error,
        } = await userClient.auth.getUser();

        if (!error && authUser) {
          let profile = null;
          try {
            profile = await userRepository.findByAuthId(authUser.id);
          } catch (_) {
            try {
              profile = await userRepository.findByEmail(authUser.email);
            } catch (_2) { /* email lookup também falhou — profile permanece null */ }
          }

          if (profile && profile.isActive) {
            req.user = {
              id: profile.id,
              authId: authUser.id,
              email: profile.email,
              perfil: profile.perfil,
              obraAtual: profile.obraAtual ?? null,
            };
          }
        }
      }
    }
  } catch (_) {
    // Ignorar erros no auth opcional — não bloqueia a requisição
  }

  next();
};

// ── Modo legado — mantido para período de transição ──────────────────────────

async function _authenticateLegacy(req, res, next) {
  const jwtConfig = require("../config/jwt");

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Token não fornecido");
    }

    const token = authHeader.substring(7);
    const decoded = jwtConfig.verifyAccessToken(token);

    let user;
    try {
      user = await userRepository.findById(decoded.id);
    } catch (_) {
      throw new UnauthorizedError("Usuário não encontrado ou inativo");
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Usuário não encontrado ou inativo");
    }

    req.user = {
      id: user.id,
      email: user.email,
      perfil: user.perfil,
      obraAtual: user.obraAtual ?? null,
    };

    next();
  } catch (error) {
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
}

async function _optionalLegacy(req, token) {
  const jwtConfig = require("../config/jwt");
  try {
    const decoded = jwtConfig.verifyAccessToken(token);
    const user = await userRepository.findById(decoded.id);
    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        perfil: user.perfil,
        obraAtual: user.obraAtual ?? null,
      };
    }
  } catch (_) { /* token inválido em auth opcional — ignorado */ }
}

module.exports = { authenticate, authorize, optionalAuth };
