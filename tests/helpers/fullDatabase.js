/**
 * Helper: banco de dados SQLite em memória completo (todas as tabelas).
 * Usado pelos testes de integração que precisam de mais tabelas do que
 * o helper básico (database.js) oferece.
 *
 * ATENÇÃO: Segue o mesmo padrão lazy getter do database.js para que a
 * chamada `jest.mock()` possa referenciar `getTestDb()` sem violar a
 * restrição de escopo de variáveis do Jest.
 */
const Knex = require("knex");

let knexInstance = null;

async function setupFullDb() {
  knexInstance = Knex({
    client: "sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  });

  // ── Usuários ───────────────────────────────────────────────────────────────
  await knexInstance.schema.createTable("users", (t) => {
    t.increments("id");
    t.string("nome");
    t.string("email").unique();
    t.string("senha");
    t.string("perfil").defaultTo("encarregado");
    t.boolean("isActive").defaultTo(true);
    t.string("syncId").nullable();
    t.string("refreshToken").nullable();
    t.text("metadata").nullable();
    t.datetime("deletedAt").nullable();
    t.timestamps(true, true);
  });

  // ── Obras ──────────────────────────────────────────────────────────────────
  await knexInstance.schema.createTable("obras", (t) => {
    t.increments("id");
    t.string("nome");
    t.string("codigo").unique().nullable();
    t.string("cliente").nullable();
    t.text("endereco").nullable();
    t.text("coordenadas").nullable();
    t.integer("responsavel").nullable();
    t.text("equipe").nullable();
    t.date("dataInicio").nullable();
    t.date("dataPrevisaoTermino").nullable();
    t.date("dataTermino").nullable();
    t.string("status").nullable();
    t.text("orcamento").nullable();
    t.text("descricao").nullable();
    t.text("observacoes").nullable();
    t.string("syncId").nullable();
    t.text("metadata").nullable();
    t.datetime("deletedAt").nullable();
    t.timestamps(true, true);
  });

  // ── Obra Encarregados (N:N) ───────────────────────────────────────────────
  await knexInstance.schema.createTableIfNotExists("obra_encarregados", (t) => {
    t.increments("id");
    t.integer("obraId").notNullable();
    t.integer("userId").notNullable();
    t.string("funcao").nullable();
    t.datetime("dataInclusao").nullable();
    t.timestamps(true, true);
  });

  // ── Purchases ─────────────────────────────────────────────────────────────
  await knexInstance.schema.createTable("purchases", (t) => {
    t.increments("id");
    t.text("items");
    t.string("status");
    t.integer("user").nullable();
    t.datetime("createdAt").nullable();
    t.timestamps(true, true);
  });

  // ── Medicoes ──────────────────────────────────────────────────────────────
  await knexInstance.schema.createTable("medicoes", (t) => {
    t.increments("id");
    t.integer("obra").nullable();
    t.integer("responsavel").nullable();
    t.datetime("data").nullable();
    t.text("periodo").nullable();
    t.text("area").nullable();
    t.string("tipoServico").nullable();
    t.decimal("comprimento", 14, 4).nullable();
    t.decimal("largura", 14, 4).nullable();
    t.decimal("altura", 14, 4).nullable();
    t.decimal("areaCalculada", 14, 4).nullable();
    t.decimal("volume", 14, 4).nullable();
    t.text("itens").nullable();
    t.text("anexos").nullable();
    t.text("observacoes").nullable();
    t.string("status").nullable();
    t.integer("aprovadoPor").nullable();
    t.datetime("dataAprovacao").nullable();
    t.text("motivoRejeicao").nullable();
    t.boolean("sincronizado").defaultTo(false);
    t.string("syncId").nullable();
    t.datetime("clientTimestamp").nullable();
    t.text("metadata").nullable();
    t.datetime("deletedAt").nullable();
    t.timestamps(true, true);
  });

  // ── Measurements (legacy) ─────────────────────────────────────────────────
  await knexInstance.schema.createTable("measurements", (t) => {
    t.increments("id");
    t.decimal("comprimento", 14, 4).nullable();
    t.decimal("largura", 14, 4).nullable();
    t.decimal("altura", 14, 4).nullable();
    t.decimal("area", 14, 4).nullable();
    t.decimal("volume", 14, 4).nullable();
    t.text("observacoes").nullable();
    t.timestamps(true, true);
  });

  // ── Solicitacoes de Compra ─────────────────────────────────────────────────
  await knexInstance.schema.createTable("solicitacoes_compra", (t) => {
    t.increments("id");
    t.integer("obra").nullable();
    t.integer("solicitante").nullable();
    t.datetime("dataSolicitacao").nullable();
    t.datetime("dataNecessidade").nullable();
    t.string("prioridade").nullable();
    t.text("itens").nullable();
    t.text("justificativa").nullable();
    t.text("observacoes").nullable();
    t.text("anexos").nullable();
    t.string("status").nullable();
    t.integer("aprovadoPor").nullable();
    t.datetime("dataAprovacao").nullable();
    t.text("motivoRejeicao").nullable();
    t.datetime("dataConclusao").nullable();
    t.string("notaFiscal").nullable();
    t.decimal("valorTotal", 14, 2).nullable();
    t.boolean("sincronizado").defaultTo(false);
    t.string("syncId").nullable();
    t.datetime("clientTimestamp").nullable();
    t.text("metadata").nullable();
    t.datetime("deletedAt").nullable();
    t.timestamps(true, true);
  });

  // ── Arquivos (para compatibilidade universal) ──────────────────────────────
  await knexInstance.schema.createTable("arquivos", (t) => {
    t.increments("id");
    t.string("nome").nullable();
    t.string("nomeOriginal").nullable();
    t.string("caminho").nullable();
    t.string("url").nullable();
    t.string("tipo").defaultTo("outros");
    t.string("tipoArquivo").nullable();
    t.string("mimeType").nullable();
    t.integer("tamanho").nullable();
    t.integer("tamanhoOriginal").nullable();
    t.text("dimensoes").nullable();
    t.text("coordenadas").nullable();
    t.text("descricao").nullable();
    t.text("detalheProblema").nullable();
    t.text("tags").nullable();
    t.integer("obra").nullable();
    t.integer("uploadedBy").nullable();
    t.integer("solicitadoPor").nullable();
    t.boolean("comprimido").defaultTo(false);
    t.boolean("sincronizado").defaultTo(false);
    t.string("syncId").nullable();
    t.string("storage_provider").defaultTo("local");
    t.string("storage_path").nullable();
    t.string("storage_url").nullable();
    t.text("metadata").nullable();
    t.datetime("deletedAt").nullable();
    t.timestamps(true, true);
  });

  return knexInstance;
}

async function teardownFullDb() {
  if (knexInstance) {
    await knexInstance.destroy();
    knexInstance = null;
  }
}

function getFullDb() {
  return knexInstance;
}

module.exports = { setupFullDb, teardownFullDb, getFullDb };
