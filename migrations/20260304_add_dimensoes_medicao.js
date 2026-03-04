/**
 * Migration: adiciona colunas de dimensões individuais à tabela medicoes.
 *
 * Problema anterior: comprimento, largura e altura eram calculados no frontend
 * e apenas os resultados (area, volume) eram persistidos via campo "itens".
 * Isso impedia recuperar as dimensões brutas da medição e aplicar filtros por elas.
 *
 * Esta migration adiciona as três colunas como REAL (float) com default NULL.
 */
exports.up = async function (knex) {
  const hasComprimento = await knex.schema.hasColumn("medicoes", "comprimento");
  if (!hasComprimento) {
    await knex.schema.alterTable("medicoes", (table) => {
      table.float("comprimento").nullable(); // metros
      table.float("largura").nullable();     // metros
      table.float("altura").nullable();      // metros
      table.float("areaCalculada").nullable(); // m² (comprimento × largura)
      table.float("volume").nullable();        // m³ (comprimento × largura × altura)
    });
  }
};

exports.down = async function (knex) {
  const hasComprimento = await knex.schema.hasColumn("medicoes", "comprimento");
  if (hasComprimento) {
    await knex.schema.alterTable("medicoes", (table) => {
      table.dropColumn("comprimento");
      table.dropColumn("largura");
      table.dropColumn("altura");
      table.dropColumn("areaCalculada");
      table.dropColumn("volume");
    });
  }
};
