const request = require("supertest");
const { makeToken } = require("../helpers/auth");
const { setupFullDb, teardownFullDb, getFullDb } = require("../helpers/fullDatabase");

jest.mock("../../src/config/database", () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  isConnected: jest.fn().mockReturnValue(true),
  get knex() {
    return require("../helpers/fullDatabase").getFullDb();
  },
}));

const app = require("../../src/app");

const adminToken = makeToken({ id: 1, perfil: "admin" });
const encarregadoToken = makeToken({ id: 2, perfil: "encarregado" });
const encarregado2Token = makeToken({ id: 3, perfil: "encarregado" });

beforeAll(async () => {
  await setupFullDb();
  const db = getFullDb();

  await db("users").insert([
    { id: 1, nome: "Admin", email: "admin@obra.com", senha: "hash", perfil: "admin", isActive: true },
    { id: 2, nome: "Enc 1", email: "enc1@obra.com", senha: "hash", perfil: "encarregado", isActive: true },
    { id: 3, nome: "Enc 2", email: "enc2@obra.com", senha: "hash", perfil: "encarregado", isActive: true },
  ]);

  await db("obras").insert([{ id: 1, nome: "Obra Diario", codigo: "OBR-DIARIO", status: "em_andamento" }]);

  await db.schema.createTable("obra_encarregados", (t) => {
    t.integer("obraId");
    t.integer("userId");
    t.string("funcao").nullable();
    t.datetime("dataInclusao").nullable();
  });

  await db("obra_encarregados").insert([
    { obraId: 1, userId: 2, funcao: "encarregado", dataInclusao: new Date() },
    { obraId: 1, userId: 3, funcao: "encarregado", dataInclusao: new Date() },
  ]);
});

afterAll(async () => {
  await teardownFullDb();
});

describe("POST /api/diarios", () => {
  test("201 cria diário", async () => {
    const res = await request(app)
      .post("/api/diarios")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send({
        obra: 1,
        data: "2026-03-09T10:00:00.000Z",
        clima: "ensolarado",
        ocorrencias: [{ descricao: "Entrega de material", hora: "10:00" }],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.obra).toBe(1);
    expect(Array.isArray(res.body.data.ocorrencias)).toBe(true);
  });

  test("201 permite novo registro no mesmo dia com payload válido", async () => {
    const res = await request(app)
      .post("/api/diarios")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send({
        obra: 1,
        data: "2026-03-09T18:00:00.000Z",
        ocorrencias: [{ descricao: "Chuva forte", hora: "15:30" }],
        visitantes: [{ nome: "Fiscal", empresa: "Prefeitura" }],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.ocorrencias)).toBe(true);
  });
});

describe("GET /api/diarios", () => {
  test("200 admin lista todos", async () => {
    const res = await request(app)
      .get("/api/diarios")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test("403 encarregado não lista todos", async () => {
    const res = await request(app)
      .get("/api/diarios")
      .set("Authorization", `Bearer ${encarregadoToken}`);

    expect(res.status).toBe(403);
  });
});

describe("Permissões por dono", () => {
  let diarioId;

  beforeAll(async () => {
    const createRes = await request(app)
      .post("/api/diarios")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send({ obra: 1, data: "2026-03-10T09:00:00.000Z", clima: "nublado" });

    diarioId = createRes.body.data.id;
  });

  test("encarregado diferente não pode acessar diário de outro", async () => {
    const res = await request(app)
      .get(`/api/diarios/${diarioId}`)
      .set("Authorization", `Bearer ${encarregado2Token}`);

    expect(res.status).toBe(403);
  });

  test("encarregado diferente não pode excluir diário de outro", async () => {
    const res = await request(app)
      .delete(`/api/diarios/${diarioId}`)
      .set("Authorization", `Bearer ${encarregado2Token}`);

    expect(res.status).toBe(403);
  });
});
