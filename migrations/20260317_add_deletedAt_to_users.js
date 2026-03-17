/**
 * Adiciona a coluna "deletedAt" TIMESTAMPTZ à tabela users para permitir
 * soft-delete consistente com as demais tabelas do sistema (obras, medicoes, arquivos).
 *
 * Se o banco já tiver a coluna (criado via supabase_setup.sql atualizado),
 * a migration verifica antes de adicionar (idempotente).
 */
exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "deletedAt");
  if (!hasColumn) {
    await knex.schema.alterTable("users", (table) => {
      table.datetime("deletedAt").nullable().defaultTo(null);
    });
  }
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "deletedAt");
  if (hasColumn) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("deletedAt");
    });
  }
};
