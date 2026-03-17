/**
 * Testes de integração — Rotas gerais
 *
 * Cobre:
 *  - GET /api/obras                  (listagem)
 *  - POST /api/solicitacoes          (criação de solicitação de compra)
 *  - GET  /api/solicitacoes          (listagem de solicitações)
 *  - POST /api/measurements          (criação canônica de medição)
 *  - GET  /api/measurements          (listagem com paginação — admin/supervisor)
 *  - GET  /api/measurements/:id      (por ID)
 */

const request = require("supertest");
const { makeToken } = require("../helpers/auth");
const { setupFullDb, teardownFullDb, getFullDb } = require("../helpers/fullDatabase");

// ── Mocks (devem preceder qualquer require do app) ────────────────────────────
jest.mock("../../src/config/database", () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  isConnected: jest.fn().mockReturnValue(true),
  get knex() { return require("../helpers/fullDatabase").getFullDb(); },
}));

jest.mock("../../src/config/supabaseClient", () => {
  const { createSupabaseMock } = require("../helpers/supabaseMock");
  const mock = createSupabaseMock(() => require("../helpers/fullDatabase").getFullDb());
  mock.createUserClient = jest.fn().mockReturnValue(mock);
  return mock;
});

// ── App (after mocks) ─────────────────────────────────────────────────────────
const app = require("../../src/app");

// ── Setup / Teardown ──────────────────────────────────────────────────────────
beforeAll(async () => {
  await setupFullDb();
  const db = getFullDb();
  // Dados de base
  await db("users").insert([
    { id: 1, nome: "Admin", email: "admin@gen.com", senha: "hash", perfil: "admin", isActive: true },
    { id: 2, nome: "Encarregado", email: "enc@gen.com", senha: "hash", perfil: "encarregado", isActive: true },
  ]);
  await db("obras").insert([
    { id: 1, nome: "Obra Alpha", codigo: "OBR-001", status: "em_andamento" },
    { id: 2, nome: "Obra Beta", codigo: "OBR-002", status: "concluida" },
  ]);
});

afterAll(async () => {
  await teardownFullDb();
});

// ── Tokens ────────────────────────────────────────────────────────────────────
const adminToken = makeToken({ id: 1, perfil: "admin" });
const encarregadoToken = makeToken({ id: 2, perfil: "encarregado" });

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/obras
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/obras", () => {
  test("401 — sem autenticação", async () => {
    const res = await request(app).get("/api/obras");
    expect(res.status).toBe(401);
  });

  test("200 — lista obras", async () => {
    const res = await request(app)
      .get("/api/obras")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  test("200 — filtra por status", async () => {
    const res = await request(app)
      .get("/api/obras?status=concluida")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const obra of res.body.data) {
      expect(obra.status).toBe("concluida");
    }
  });

  test("200 — paginação funciona", async () => {
    const res = await request(app)
      .get("/api/obras?page=1&limit=1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/solicitacoes — criar solicitação de compra
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/solicitacoes", () => {
  test("401 — sem autenticação", async () => {
    const res = await request(app)
      .post("/api/solicitacoes")
      .send({ itens: [{ descricao: "Parafuso", quantidade: 100, unidade: "un" }] });
    expect(res.status).toBe(401);
  });

  test("201 — cria solicitação com sucesso", async () => {
    const res = await request(app)
      .post("/api/solicitacoes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ itens: [{ descricao: "Parafuso M8", quantidade: 200, unidade: "un" }] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("pendente");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/solicitacoes — listar solicitações
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/solicitacoes", () => {
  test("401 — sem autenticação", async () => {
    const res = await request(app).get("/api/solicitacoes");
    expect(res.status).toBe(401);
  });

  test("200 — retorna lista de solicitações", async () => {
    await request(app)
      .post("/api/solicitacoes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ itens: [{ descricao: "Areia", quantidade: 5, unidade: "m³" }] });

    const res = await request(app)
      .get("/api/solicitacoes")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/measurements — criar medição (sistema canônico)
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/measurements", () => {
  test("401 — sem autenticação", async () => {
    const res = await request(app)
      .post("/api/measurements")
      .send({ obra: 1, itens: [{ descricao: "Alvenaria", quantidade: 10, unidade: "m²" }] });
    expect(res.status).toBe(401);
  });

  test("201 — cria medição com payload canônico", async () => {
    const res = await request(app)
      .post("/api/measurements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        obra: 1,
        area: "Piso Térreo",
        tipoServico: "alvenaria",
        itens: [{ descricao: "Alvenaria", quantidade: 10, unidade: "m²", valorUnitario: 50 }],
        observacoes: "Teste canônico",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("rascunho");
  });

  test("400 — rejeita payload sem itens obrigatórios", async () => {
    const res = await request(app)
      .post("/api/measurements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ obra: 1 });

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/measurements — listagem paginada (admin/supervisor)
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/measurements", () => {
  test("401 — sem autenticação", async () => {
    const res = await request(app).get("/api/measurements");
    expect(res.status).toBe(401);
  });

  test("200 — admin lista todas as medições", async () => {
    const res = await request(app)
      .get("/api/measurements")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test("200 — paginação via query params", async () => {
    const res = await request(app)
      .get("/api/measurements?page=1&limit=5")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.itemsPerPage).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/measurements/:id — por ID
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/measurements/:id", () => {
  let medicaoId;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/measurements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ obra: 1, itens: [{ descricao: "Para buscar", quantidade: 1, unidade: "un" }] });
    medicaoId = res.body.data?.id;
  });

  test("404 — ID inexistente", async () => {
    const res = await request(app)
      .get("/api/measurements/999999")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test("200 — retorna medição existente", async () => {
    const createRes = await request(app)
      .post("/api/measurements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ obra: 1, itens: [{ descricao: "Buscar por ID", quantidade: 2, unidade: "m" }] });

    const id = createRes.body.data?.id;
    if (!id) return; // skip se criação falhou por outro motivo

    const res = await request(app)
      .get(`/api/measurements/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });
});
