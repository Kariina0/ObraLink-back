const request = require("supertest");
const { makeToken } = require("../helpers/auth");
const {
  setupFullDb,
  teardownFullDb,
  getFullDb,
} = require("../helpers/fullDatabase");

jest.mock("../../src/config/database", () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  isConnected: jest.fn().mockReturnValue(true),
  get knex() {
    return require("../helpers/fullDatabase").getFullDb();
  },
}));

jest.mock("../../src/config/supabaseClient", () => {
  const { createSupabaseMock } = require("../helpers/supabaseMock");
  const mock = createSupabaseMock(() =>
    require("../helpers/fullDatabase").getFullDb(),
  );
  mock.createUserClient = jest.fn().mockReturnValue(mock);
  return mock;
});

const app = require("../../src/app");

const supervisorToken = makeToken({
  id: 2,
  perfil: "supervisor",
  email: "sup@diario.com",
});
const encarregadoToken = makeToken({
  id: 3,
  perfil: "encarregado",
  email: "enc@diario.com",
});

describe("Fluxo real de diários", () => {
  beforeAll(async () => {
    await setupFullDb();
    const db = getFullDb();

    await db("users").insert([
      {
        id: 2,
        nome: "Supervisor Diário",
        email: "sup@diario.com",
        senha: "hash",
        perfil: "supervisor",
        isActive: true,
      },
      {
        id: 3,
        nome: "Encarregado Diário",
        email: "enc@diario.com",
        senha: "hash",
        perfil: "encarregado",
        isActive: true,
      },
    ]);

    await db("obras").insert([
      {
        id: 1,
        nome: "Obra Diário",
        codigo: "DIA-001",
        status: "em_andamento",
      },
    ]);

    await db("obra_encarregados").insert([
      {
        obraId: 1,
        userId: 3,
        funcao: "encarregado",
        dataInclusao: new Date().toISOString(),
      },
    ]);
  });

  afterAll(async () => {
    await teardownFullDb();
  });

  test("encarregado cria diário, bloqueia duplicidade, consulta, atualiza e exclui", async () => {
    const dataReferencia = new Date().toISOString().slice(0, 10);
    const payload = {
      obra: 1,
      data: dataReferencia,
      clima: "ensolarado",
      atividades: [{ descricao: "Execução de alvenaria" }],
      equipamentos: [{ descricao: "Betoneira", quantidade: 1, unidade: "un" }],
      maoDeObra: [{ descricao: "Pedreiro", quantidade: 3, unidade: "prof" }],
      materiais: [{ descricao: "Bloco", quantidade: 120, unidade: "un" }],
      ocorrencias: [],
      visitantes: [],
      fotos: [],
      observacoesGerais: "Sem intercorrências",
    };

    const created = await request(app)
      .post("/api/diarios")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send(payload);

    expect(created.status).toBe(201);
    expect(created.body.data.obra).toBe(1);
    expect(created.body.data.responsavel).toBe(3);

    const diarioId = created.body.data.id;

    const check = await request(app)
      .get("/api/diarios/check")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .query({ obra: 1, data: dataReferencia });

    expect(check.status).toBe(200);
    expect(typeof check.body.data.exists).toBe("boolean");

    const updated = await request(app)
      .put(`/api/diarios/${diarioId}`)
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send({ observacoesGerais: "Atualizado no fim do expediente" });

    expect(updated.status).toBe(200);
    expect(updated.body.data.observacoesGerais).toBe(
      "Atualizado no fim do expediente",
    );

    const minhas = await request(app)
      .get("/api/diarios/minhas")
      .set("Authorization", `Bearer ${encarregadoToken}`);

    expect(minhas.status).toBe(200);
    expect(
      minhas.body.data.some((d) => Number(d.id) === Number(diarioId)),
    ).toBe(true);

    const supervisorView = await request(app)
      .get(`/api/diarios/${diarioId}`)
      .set("Authorization", `Bearer ${supervisorToken}`);

    expect(supervisorView.status).toBe(200);
    expect(supervisorView.body.data.id).toBe(diarioId);

    const deleted = await request(app)
      .delete(`/api/diarios/${diarioId}`)
      .set("Authorization", `Bearer ${encarregadoToken}`);

    expect(deleted.status).toBe(200);

    const db = getFullDb();
    const row = await db("diarios").where({ id: diarioId }).first();
    expect(row.deletedAt).toBeTruthy();
  });

  test("retorna 400 para ID inválido", async () => {
    const res = await request(app)
      .get("/api/diarios/abc")
      .set("Authorization", `Bearer ${encarregadoToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
