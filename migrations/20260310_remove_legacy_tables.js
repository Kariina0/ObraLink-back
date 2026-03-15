/**
 * Migration: Remove legacy tables
 *
 * Tabelas `measurements` e `purchases` foram criadas na migration inicial
 * para compatibilidade com um modelo anterior, mas nunca foram utilizadas
 * pelo sistema atual (que usa `medicoes` e `solicitacoes_compra`).
 *
 * Esta migration as remove definitivamente para limpar o schema.
 */

exports.up = async function (knex) {
  await knex.schema.dropTableIfExists("purchases");
  await knex.schema.dropTableIfExists("measurements");
};

exports.down = async function (knex) {
  // Recria as tabelas legadas caso seja necessário reverter a migration

  await knex.schema.createTable("measurements", (table) => {
    table.increments("id");
    table.decimal("comprimento", 14, 4).nullable();
    table.decimal("largura", 14, 4).nullable();
    table.decimal("altura", 14, 4).nullable();
    table.decimal("area", 14, 4).nullable();
    table.decimal("volume", 14, 4).nullable();
    table.text("observacoes");
    table.timestamps(true, true);
  });

  await knex.schema.createTable("purchases", (table) => {
    table.increments("id");
    table.text("items");
    table.string("status");
    table.integer("user").unsigned().nullable();
    table.datetime("createdAt").nullable();
    table.timestamps(true, true);
  });
};
