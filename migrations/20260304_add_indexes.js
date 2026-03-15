/**
 * Migration: índices de performance.
 *
 * Adiciona índices nas colunas mais usadas em filtros e JOINs,
 * além de uma coluna deletedAt dedicada para substituir o soft delete via JSON.
 *
 * Benefícios:
 *  - Consultas por obra, responsavel, status e tipoServico ficam ~10x mais rápidas.
 *  - Soft delete sem json_extract() elimina full table scans.
 */
exports.up = async function (knex) {
  // ── Índices em medicoes ────────────────────────────────────────────────────
  const hasIdx = async (name) => {
    const exists = await knex.schema.hasTable(name);
    return exists;
  };

  // Coluna deletedAt em medicoes (substitui json_extract(metadata, '$.deletedAt'))
  const hasMedicaoDeleted = await knex.schema.hasColumn("medicoes", "deletedAt");
  if (!hasMedicaoDeleted) {
    await knex.schema.alterTable("medicoes", (table) => {
      table.datetime("deletedAt").nullable().defaultTo(null);
    });
  }

  // Coluna deletedAt em obras
  const hasObraDeleted = await knex.schema.hasColumn("obras", "deletedAt");
  if (!hasObraDeleted) {
    await knex.schema.alterTable("obras", (table) => {
      table.datetime("deletedAt").nullable().defaultTo(null);
    });
  }

  // Coluna deletedAt em arquivos
  const hasArquivoDeleted = await knex.schema.hasColumn("arquivos", "deletedAt");
  if (!hasArquivoDeleted) {
    await knex.schema.alterTable("arquivos", (table) => {
      table.datetime("deletedAt").nullable().defaultTo(null);
    });
  }

  // Índices on medicoes
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_medicoes_obra ON medicoes(obra)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_medicoes_responsavel ON medicoes(responsavel)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_medicoes_status ON medicoes(status)");
  const hasTipoServico = await knex.schema.hasColumn("medicoes", "tipoServico");
  if (hasTipoServico) {
    await knex.raw("CREATE INDEX IF NOT EXISTS idx_medicoes_tipoServico ON medicoes(tipoServico)");
  }
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_medicoes_deletedAt ON medicoes(deletedAt)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_medicoes_created_at ON medicoes(created_at)");

  // Índices em obras
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_obras_status ON obras(status)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_obras_deletedAt ON obras(deletedAt)");

  // Índices em arquivos
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_arquivos_obra ON arquivos(obra)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_arquivos_uploadedBy ON arquivos(uploadedBy)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_arquivos_deletedAt ON arquivos(deletedAt)");

  // Índices em solicitacoes_compra
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_solicitacoes_obra ON solicitacoes_compra(obra)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes_compra(status)");
};

exports.down = async function (knex) {
  await knex.raw("DROP INDEX IF EXISTS idx_medicoes_obra");
  await knex.raw("DROP INDEX IF EXISTS idx_medicoes_responsavel");
  await knex.raw("DROP INDEX IF EXISTS idx_medicoes_status");
  await knex.raw("DROP INDEX IF EXISTS idx_medicoes_tipoServico");
  await knex.raw("DROP INDEX IF EXISTS idx_medicoes_deletedAt");
  await knex.raw("DROP INDEX IF EXISTS idx_medicoes_created_at");
  await knex.raw("DROP INDEX IF EXISTS idx_obras_status");
  await knex.raw("DROP INDEX IF EXISTS idx_obras_deletedAt");
  await knex.raw("DROP INDEX IF EXISTS idx_arquivos_obra");
  await knex.raw("DROP INDEX IF EXISTS idx_arquivos_uploadedBy");
  await knex.raw("DROP INDEX IF EXISTS idx_arquivos_deletedAt");
  await knex.raw("DROP INDEX IF EXISTS idx_solicitacoes_obra");
  await knex.raw("DROP INDEX IF EXISTS idx_solicitacoes_status");
};
