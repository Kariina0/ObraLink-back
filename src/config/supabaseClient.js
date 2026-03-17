require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const logger = require("../utils/logger");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios. Configure o arquivo .env."
  );
}

/**
 * Cliente Supabase com service_role key.
 * Bypassa RLS — use apenas no backend (nunca exponha no frontend).
 * Adequado para todas as operações server-side.
 */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  db: {
    schema: "public",
  },
});

/**
 * Cria um cliente Supabase escopado ao usuário autenticado (para verificar tokens).
 * Usado pelo middleware de auth para validar JWTs do Supabase.
 * @param {string} accessToken - JWT do usuário
 */
function createUserClient(accessToken) {
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_ANON_KEY é obrigatório para validação de tokens de usuário.");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

logger.info("Supabase client (service_role) inicializado.");

module.exports = supabase;
module.exports.createUserClient = createUserClient;
