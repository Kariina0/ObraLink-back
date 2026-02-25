exports.up = async function (knex) {
  // Users
  await knex.schema.createTable("users", (table) => {
    table.increments("id");
    table.string("nome");
    table.string("email").unique();
    table.string("senha");
    table.string("perfil");
    table.integer("obraAtual").unsigned().nullable();
    table.boolean("isActive").defaultTo(true);
    table.datetime("lastSync").nullable();
    table.string("syncId").unique().nullable();
    table.string("refreshToken").nullable();
    table.boolean("sincronizado").defaultTo(false);
    table.text("metadata");
    table.timestamps(true, true);
  });

  // Obras
  await knex.schema.createTable("obras", (table) => {
    table.increments("id");
    table.string("nome");
    table.string("codigo").unique();
    table.text("endereco");
    table.text("coordenadas");
    table.integer("responsavel").unsigned().nullable();
    table.text("equipe");
    table.date("dataInicio");
    table.date("dataPrevisaoTermino");
    table.date("dataTermino");
    table.string("status");
    table.text("orcamento");
    table.text("descricao");
    table.text("observacoes");
    table.string("syncId").unique().nullable();
    table.text("metadata");
    table.timestamps(true, true);
  });

  // Arquivos
  await knex.schema.createTable("arquivos", (table) => {
    table.increments("id");
    table.string("nome");
    table.string("nomeOriginal");
    table.string("caminho");
    table.string("url");
    table.string("tipo");
    table.string("mimeType");
    table.integer("tamanho");
    table.text("dimensoes");
    table.text("coordenadas");
    table.text("descricao");
    table.text("tags");
    table.integer("obra").unsigned().nullable();
    table.integer("uploadedBy").unsigned().nullable();
    table.boolean("comprimido").defaultTo(false);
    table.integer("tamanhoOriginal").nullable();
    table.boolean("sincronizado").defaultTo(false);
    table.string("syncId").unique().nullable();
    table.datetime("clientTimestamp").nullable();
    table.text("metadata");
    table.timestamps(true, true);
  });

  // Medicoes
  await knex.schema.createTable("medicoes", (table) => {
    table.increments("id");
    table.integer("obra").unsigned().nullable();
    table.integer("responsavel").unsigned().nullable();
    table.datetime("data").nullable();
    table.text("periodo");
    table.text("itens");
    table.text("anexos");
    table.text("observacoes");
    table.string("status");
    table.integer("aprovadoPor").unsigned().nullable();
    table.datetime("dataAprovacao").nullable();
    table.boolean("sincronizado").defaultTo(false);
    table.string("syncId").unique().nullable();
    table.datetime("clientTimestamp").nullable();
    table.text("metadata");
    table.timestamps(true, true);
  });

  // Diarios
  await knex.schema.createTable("diarios", (table) => {
    table.increments("id");
    table.integer("obra").unsigned().nullable();
    table.integer("responsavel").unsigned().nullable();
    table.datetime("data").nullable();
    table.text("clima");
    table.text("equipamentos");
    table.text("maoDeObra");
    table.text("atividades");
    table.text("materiais");
    table.text("ocorrencias");
    table.text("visitantes");
    table.text("fotos");
    table.text("observacoesGerais");
    table.text("assinatura");
    table.boolean("sincronizado").defaultTo(false);
    table.string("syncId").unique().nullable();
    table.datetime("clientTimestamp").nullable();
    table.text("metadata");
    table.timestamps(true, true);
  });

  // Solicitacoes de Compra
  await knex.schema.createTable("solicitacoes_compra", (table) => {
    table.increments("id");
    table.integer("obra").unsigned().nullable();
    table.integer("solicitante").unsigned().nullable();
    table.datetime("dataSolicitacao").nullable();
    table.datetime("dataNecessidade").nullable();
    table.string("prioridade");
    table.text("itens");
    table.text("justificativa");
    table.text("observacoes");
    table.text("anexos");
    table.string("status");
    table.integer("aprovadoPor").unsigned().nullable();
    table.datetime("dataAprovacao").nullable();
    table.text("motivoRejeicao");
    table.datetime("dataConclusao").nullable();
    table.string("notaFiscal");
    table.decimal("valorTotal", 14, 2).nullable();
    table.boolean("sincronizado").defaultTo(false);
    table.string("syncId").unique().nullable();
    table.datetime("clientTimestamp").nullable();
    table.text("metadata");
    table.timestamps(true, true);
  });

  // Purchases (legacy/other model)
  await knex.schema.createTable("purchases", (table) => {
    table.increments("id");
    table.text("items");
    table.string("status");
    table.integer("user").unsigned().nullable();
    table.datetime("createdAt").nullable();
    table.timestamps(true, true);
  });

  // Measurement
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
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("measurements");
  await knex.schema.dropTableIfExists("purchases");
  await knex.schema.dropTableIfExists("solicitacoes_compra");
  await knex.schema.dropTableIfExists("diarios");
  await knex.schema.dropTableIfExists("medicoes");
  await knex.schema.dropTableIfExists("arquivos");
  await knex.schema.dropTableIfExists("obras");
  await knex.schema.dropTableIfExists("users");
};
