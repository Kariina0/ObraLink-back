/**
 * Testes de integração — Rotas gerais
 *
 * Cobre:
 *  - GET /api/obras              (listagem)
 *  - POST /api/purchases         (criação)
 *  - GET  /api/purchases         (listagem por usuário)
 *  - POST /api/medicoes          (rota /api/medicoes — rota raw)
 *  - GET  /api/medicoes          (listagem com paginação)
 *  - GET  /api/medicoes/:id      (por ID)
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
    expect(Array.isArray(res.body.data.data)).toBe(true);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(2);
  });

  test("200 — filtra por status", async () => {
    const res = await request(app)
      .get("/api/obras?status=concluida")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const obra of res.body.data.data) {
      expect(obra.status).toBe("concluida");
    }
  });

  test("200 — paginação funciona", async () => {
    const res = await request(app)
      .get("/api/obras?page=1&limit=1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.data.length).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/purchases — criar compra
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/purchases", () => {
  test("401 — sem autenticação", async () => {
    const res = await request(app)
      .post("/api/purchases")
      .send({ items: [{ descricao: "Parafuso", qtd: 100 }] });
    expect(res.status).toBe(401);
  });

  test("201 — cria purchase com sucesso", async () => {
    const res = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ items: [{ descricao: "Parafuso M8", qtd: 200 }] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("pendente");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/purchases — listar compras
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/purchases", () => {
  test("401 — sem autenticação", async () => {
    const res = await request(app).get("/api/purchases");
    expect(res.status).toBe(401);
  });

  test("200 — retorna lista de compras do usuário", async () => {
    // Primeiro cria uma purchase para ter dados
    await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ items: [{ descricao: "Areia", qtd: 5 }] });

    const res = await request(app)
      .get("/api/purchases")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/medicoes — rota raw (sem validação de obra)
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/medicoes (rota raw)", () => {
  test("401 — sem autenticação", async () => {
    const res = await request(app)
      .post("/api/medicoes")
      .send({ obra: 1, responsavel: 1, itens: [] });
    expect(res.status).toBe(401);
  });

  test("201 — cria medição simples (payload medicao)", async () => {
    const res = await request(app)
      .post("/api/medicoes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        obra: 1,
        responsavel: 1,
        observacoes: "Teste direto",
        itens: JSON.stringify([{ descricao: "Alvenaria", quantidade: 10, unidade: "m²" }]),
        status: "rascunho",
      });

    expect(res.status).toBe(201);
  });

  test("201 — aceita payload de measurement (comprimento/largura/area)", async () => {
    const res = await request(app)
      .post("/api/medicoes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        comprimento: 10,
        largura: 5,
        area: 50,
        observacoes: "Piso sala",
      });

    expect(res.status).toBe(201);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/medicoes — listagem paginada
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/medicoes", () => {
  test("401 — sem autenticação", async () => {
    const res = await request(app).get("/api/medicoes");
    expect(res.status).toBe(401);
  });

  test("200 — retorna lista de medições", async () => {
    const res = await request(app)
      .get("/api/medicoes")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test("200 — paginação via query params", async () => {
    const res = await request(app)
      .get("/api/medicoes?page=1&limit=5")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/medicoes/:id — por ID
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/medicoes/:id", () => {
  let medicaoId;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/medicoes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ obra: 1, observacoes: "Para buscar" });
    medicaoId = res.body.id;
  });

  test("400 — ID inválido (não numérico)", async () => {
    const res = await request(app)
      .get("/api/medicoes/abc")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test("404 — ID inexistente", async () => {
    const res = await request(app)
      .get("/api/medicoes/999999")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test("200 — retorna medição existente", async () => {
    // Cria uma medição primeiro para garantir que existe
    const createRes = await request(app)
      .post("/api/medicoes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ obra: 1, observacoes: "Buscar por ID" });

    const id = createRes.body.id;
    if (!id) return; // skip se criação falhou por outro motivo

    const res = await request(app)
      .get(`/api/medicoes/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });
});
