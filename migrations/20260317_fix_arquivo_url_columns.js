/**
 * Migration: corrige colunas de URL na tabela arquivos que estavam como VARCHAR(255).
 * URLs assinadas do Supabase Storage ultrapassam 255 caracteres, causando o erro
 * "value too long for type character varying(255)" ao fazer upload de fotos.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("arquivos", (table) => {
    table.text("url").alter();
    table.text("caminho").alter();
    table.text("storage_path").alter();
    table.text("storage_url").alter();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("arquivos", (table) => {
    table.string("url").alter();
    table.string("caminho").alter();
    table.string("storage_path").alter();
    table.string("storage_url").alter();
  });
};
