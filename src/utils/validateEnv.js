/**
 * validateEnv.js — valida variáveis de ambiente obrigatórias no startup.
 *
 * Lança erro imediato e impede a inicialização do servidor se qualquer
 * variável crítica estiver ausente ou em branco.
 */

const REQUIRED = [
  { key: "JWT_SECRET",              hint: "Secret para assinar access tokens JWT" },
  { key: "JWT_REFRESH_SECRET",      hint: "Secret para assinar refresh tokens JWT" },
  { key: "SUPABASE_URL",            hint: "URL do projeto Supabase (ex: https://xxx.supabase.co)" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", hint: "Chave service_role do Supabase (não a anon key)" },
];

// Obrigatórias apenas quando STORAGE_PROVIDER=supabase
const REQUIRED_IF_SUPABASE_STORAGE = [
  { key: "SUPABASE_STORAGE_BUCKET", hint: "Nome do bucket no Supabase Storage (ex: obras-arquivos)" },
];

// Recomendadas em produção (emite aviso mas não bloqueia)
const RECOMMENDED_PROD = [
  { key: "EMAIL_HOST",  hint: "Servidor SMTP — necessário para envio de e-mails de recuperação de senha" },
  { key: "EMAIL_USER",  hint: "Usuário SMTP" },
  { key: "EMAIL_PASS",  hint: "Senha SMTP" },
  { key: "EMAIL_FROM",  hint: "Endereço remetente (ex: noreply@seudominio.com.br)" },
  { key: "ALLOWED_ORIGINS", hint: "Lista de origens permitidas pelo CORS (ex: https://app.obralink.com.br)" },
];

function validateEnv() {
  const missing = [];

  for (const { key, hint } of REQUIRED) {
    if (!process.env[key] || !process.env[key].trim()) {
      missing.push(`  • ${key}  [${hint}]`);
    }
  }

  const isSupabaseStorage =
    (process.env.STORAGE_PROVIDER || "local").toLowerCase() === "supabase";

  if (isSupabaseStorage) {
    for (const { key, hint } of REQUIRED_IF_SUPABASE_STORAGE) {
      if (!process.env[key] || !process.env[key].trim()) {
        missing.push(`  • ${key}  [${hint}]  (obrigatória quando STORAGE_PROVIDER=supabase)`);
      }
    }
  }

  if (missing.length > 0) {
    const lines = [
      "",
      "═══════════════════════════════════════════════════════════════",
      "  ERRO CRÍTICO: Variáveis de ambiente obrigatórias ausentes",
      "═══════════════════════════════════════════════════════════════",
      ...missing,
      "",
      "  Crie ou edite o arquivo .env na raiz do projeto e defina",
      "  todas as variáveis listadas acima.",
      "═══════════════════════════════════════════════════════════════",
      "",
    ];
    throw new Error(lines.join("\n"));
  }

  // Avisos para produção (sem bloquear)
  if (process.env.NODE_ENV === "production") {
    const warnings = [];

    for (const { key, hint } of RECOMMENDED_PROD) {
      if (!process.env[key] || !process.env[key].trim()) {
        warnings.push(`  ⚠️  ${key}  [${hint}]`);
      }
    }

    if (warnings.length > 0) {
      console.warn(
        [
          "",
          "───────────────────────────────────────────────────────────────",
          "  AVISO: Variáveis recomendadas para produção não configuradas:",
          ...warnings,
          "───────────────────────────────────────────────────────────────",
          "",
        ].join("\n"),
      );
    }
  }
}

module.exports = validateEnv;
