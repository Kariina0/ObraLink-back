/**
 * Helper: gera tokens JWT válidos para uso nos testes.
 * Usa os mesmos secrets do .env para que o middleware authenticate aceite.
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";

/**
 * Gera um access token de teste.
 * @param {object} overrides - propriedades opcionais para sobrescrever o payload padrão
 */
function makeToken(overrides = {}) {
  const payload = {
    id: overrides.id ?? 1,
    email: overrides.email ?? "test@construcao.com",
    perfil: overrides.perfil ?? "admin",
    ...overrides,
  };
  // Expira em 1h — suficiente para qualquer suite de testes
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

/** Token com perfil admin (acesso total) */
const adminToken = makeToken({ id: 1, perfil: "admin" });

/** Token com perfil encarregado (acesso restrito) */
const encarregadoToken = makeToken({ id: 2, perfil: "encarregado" });

module.exports = { makeToken, adminToken, encarregadoToken };
