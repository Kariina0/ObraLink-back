/**
 * dbHelpers.js — Utilitários reutilizáveis para acesso ao banco de dados.
 *
 * Centraliza lógica comum que antes estava duplicada em múltiplos arquivos
 * de rota (index.js, management.js) e repositórios.
 */

/**
 * Verifica se o erro Supabase indica que a coluna "deletedAt" não existe.
 * Útil antes da migration ser aplicada em ambientes de teste ou staging.
 * @param {object} error
 * @returns {boolean}
 */
function isMissingDeletedAtColumn(error) {
  const message = String(error?.message || "").toLowerCase();
  // Detecta situações diferentes dependendo do DB/driver:
  // - PostgreSQL/Supabase: "deletedAt" + "does not exist"
  // - SQLite (em testes/local): pode falhar ao interpretar operator ::jsonb (unrecognized token ":")
  // - Alguns drivers retornam "no such column"
  return (
    (message.includes("deletedat") && (message.includes("does not exist") || message.includes("no such column"))) ||
    message.includes("unrecognized token") ||
    message.includes("jsonb")
  );
}

/**
 * Executa uma query Supabase primeiro COM filtro de soft-delete (deletedAt IS NULL)
 * e, caso o banco retorne erro de coluna inexistente (ambiente sem migration),
 * repete a query SEM o filtro.
 *
 * @param {(withDeletedAt: boolean) => Promise<{ data, error, count? }>} buildQuery
 * @returns {Promise<{ data, error, count? }>}
 *
 * @example
 * const { data, error } = await runWithDeletedAtFallback((withSoftDelete) => {
 *   let q = supabase.from("obras").select("*");
 *   if (withSoftDelete) q = q.is("deletedAt", null);
 *   return q;
 * });
 */
async function runWithDeletedAtFallback(buildQuery) {
  const firstTry = await buildQuery(true);
  if (!firstTry.error || !isMissingDeletedAtColumn(firstTry.error)) {
    return firstTry;
  }
  return buildQuery(false);
}

module.exports = { isMissingDeletedAtColumn, runWithDeletedAtFallback };
