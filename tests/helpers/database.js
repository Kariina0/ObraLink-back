/**
 * Helper: banco de dados SQLite em memória para testes.
 * Cria e destrói uma instância isolada do Knex por suite de testes,
 * garantindo que os testes não contaminem o banco de desenvolvimento.
 */
const Knex = require("knex");

let knexInstance = null;

async function setupTestDb() {
  knexInstance = Knex({
    client: "sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  });

  // Tabela mínima de arquivos necessária para os testes
  await knexInstance.schema.createTableIfNotExists("arquivos", (t) => {
    t.increments("id");
    t.string("nome");
    t.string("nomeOriginal");
    t.string("caminho").nullable();
    t.string("url").nullable();
    t.string("tipo").defaultTo("outros");
    t.string("tipoArquivo").nullable();
    t.string("mimeType");
    t.integer("tamanho");
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

  // Tabela mínima de usuários (necessária para o middleware authenticate)
  await knexInstance.schema.createTableIfNotExists("users", (t) => {
    t.increments("id");
    t.string("nome");
    t.string("email").unique();
    t.string("senha");
    t.string("perfil").defaultTo("encarregado");
    t.boolean("isActive").defaultTo(true);
    t.string("syncId").nullable();
    t.string("refreshToken").nullable();  // necessário para o fluxo de refresh token
    t.text("metadata").nullable();
    t.datetime("deletedAt").nullable();
    t.timestamps(true, true);
  });

  // Inserir usuário de teste
  await knexInstance("users").insert({
    id: 1,
    nome: "Test Admin",
    email: "test@construcao.com",
    senha: "hashed",
    perfil: "admin",
    isActive: true,
  });

  return knexInstance;
}

async function teardownTestDb() {
  if (knexInstance) {
    await knexInstance.destroy();
    knexInstance = null;
  }
}

function getTestDb() {
  return knexInstance;
}

module.exports = { setupTestDb, teardownTestDb, getTestDb };
