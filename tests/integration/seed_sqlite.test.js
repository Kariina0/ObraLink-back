const fs = require("fs");
const os = require("os");
const path = require("path");
const Knex = require("knex");

// Teste legado do script de seed SQLite.
// Skipped pois scripts/seed_sqlite.js cria internamente uma conexão via knexfile.development
// que agora aponta para PostgreSQL/Supabase. Mantido no repositório como documentação.
// Reativar somente se o script for atualizado para aceitar injeção de knex externo.
describe.skip("seed SQLite", () => {
  let tempDir;
  let dbPath;
  let knex;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "seed-sqlite-"));
    dbPath = path.join(tempDir, "test.sqlite");
    process.env.DB_PATH = dbPath;

    jest.resetModules();

    knex = Knex({
      client: "sqlite3",
      connection: { filename: dbPath },
      useNullAsDefault: true,
      migrations: { directory: path.join(__dirname, "../../migrations") },
    });

    await knex.migrate.latest();
  });

  afterEach(async () => {
    delete process.env.DB_PATH;

    if (knex) {
      await knex.destroy();
      knex = null;
    }

    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  test("popula o schema atual sem depender de tabelas legadas", async () => {
    const { seed } = require("../../scripts/seed_sqlite");

    await expect(seed({ exitOnComplete: false })).resolves.toEqual({
      users: expect.arrayContaining([1, 2, 3, 4]),
      obras: expect.arrayContaining([1, 2, 3]),
    });

    const userCount = await knex("users").count({ count: "id" }).first();
    const obraCount = await knex("obras").count({ count: "id" }).first();
    const admin = await knex("users").where({ email: "admin@construcao.com" }).first();
    const encarregado1 = await knex("users").where({ email: "joao@construcao.com" }).first();
    const encarregado2 = await knex("users").where({ email: "pedro@construcao.com" }).first();

    expect(Number(userCount.count)).toBe(4);
    expect(Number(obraCount.count)).toBe(3);
    expect(admin).toBeDefined();
    expect(encarregado1.obraAtual).toBe(1);
    expect(encarregado2.obraAtual).toBe(2);
  });
});
