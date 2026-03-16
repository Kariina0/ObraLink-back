/**
 * Migration: Adiciona coluna dedicada motivoRejeicao em medicoes.
 *
 * Anteriormente o motivo era salvo dentro do campo metadata (JSON).
 * Uma coluna dedicada permite filtros SQL diretos e melhora a legibilidade
 * em relatórios e no dashboard de gestão.
 */

exports.up = async function (knex) {
  const hasCol = await knex.schema.hasColumn("medicoes", "motivoRejeicao");
  if (!hasCol) {
    await knex.schema.alterTable("medicoes", (table) => {
      table.text("motivoRejeicao").nullable();
    });
  }
};

exports.down = async function (knex) {
  const hasCol = await knex.schema.hasColumn("medicoes", "motivoRejeicao");
  if (hasCol) {
    await knex.schema.alterTable("medicoes", (table) => {
      table.dropColumn("motivoRejeicao");
    });
  }
};
