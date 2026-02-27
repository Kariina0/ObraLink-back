/**
 * Migration: adicionar colunas de suporte ao Supabase Storage na tabela arquivos.
 * - storage_provider: identifica onde o arquivo está guardado ("local" | "supabase")
 * - storage_path: path dentro do bucket (ex: "fotos/uuid-arquivo.jpg")
 * - storage_url: URL pública ou assinada gerada pelo storage provider
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("arquivos", (table) => {
    table.string("storage_provider").defaultTo("local").notNullable();
    table.string("storage_path").nullable();
    table.string("storage_url").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("arquivos", (table) => {
    table.dropColumn("storage_provider");
    table.dropColumn("storage_path");
    table.dropColumn("storage_url");
  });
};
