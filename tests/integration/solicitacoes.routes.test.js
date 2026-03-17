/**
 * Testes de integração — Rotas /api/solicitacoes
 *
 * Cobre:
 *  - POST /api/solicitacoes         (criação: sucesso, sem itens, sem autenticação)
 *  - GET  /api/solicitacoes         (listagem com paginação, filtro por perfil)
 *  - GET  /api/solicitacoes/:id     (por ID: sucesso, não encontrado)
 *  - POST /api/solicitacoes/:id/aprovar  (sucesso, sem permissão)
 *  - POST /api/solicitacoes/:id/rejeitar (sucesso)
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
  await db("users").insert([
    { id: 1, nome: "Admin", email: "admin@sol.com", senha: "hash", perfil: "admin", isActive: true },
    { id: 2, nome: "Supervisor", email: "super@sol.com", senha: "hash", perfil: "supervisor", isActive: true },
    { id: 3, nome: "Encarregado", email: "enc@sol.com", senha: "hash", perfil: "encarregado", isActive: true },
  ]);
});

afterAll(async () => {
  await teardownFullDb();
});

// ── Tokens ────────────────────────────────────────────────────────────────────
const adminToken = makeToken({ id: 1, perfil: "admin" });
const supervisorToken = makeToken({ id: 2, perfil: "supervisor" });
const encarregadoToken = makeToken({ id: 3, perfil: "encarregado" });

// ── Payload de solicitação válido ─────────────────────────────────────────────
const solicitacaoValida = {
  itens: [
    { descricao: "Cimento 50kg", quantidade: 10, unidade: "un", valorUnitario: 45.0 },
  ],
  prioridade: "alta",
  justificativa: "Necessário para fundação",
};

// ═══════════════════════════════════════════════════════════════════════════════
// Autenticação obrigatória
// ═══════════════════════════════════════════════════════════════════════════════
describe("Autenticação obrigatória — /api/solicitacoes", () => {
  test("POST sem token → 401", async () => {
    const res = await request(app).post("/api/solicitacoes").send(solicitacaoValida);
    expect(res.status).toBe(401);
  });

  test("GET sem token → 401", async () => {
    const res = await request(app).get("/api/solicitacoes");
    expect(res.status).toBe(401);
  });

  test("GET /:id sem token → 401", async () => {
    const res = await request(app).get("/api/solicitacoes/1");
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/solicitacoes — criação
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/solicitacoes", () => {
  test("201 — cria solicitação com dados válidos", async () => {
    const res = await request(app)
      .post("/api/solicitacoes")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send(solicitacaoValida);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("pendente");
    expect(res.body.data.solicitante).toBe(3);
  });

  test("400 — sem itens no array", async () => {
    const res = await request(app)
      .post("/api/solicitacoes")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send({ itens: [], prioridade: "media" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("400 — itens é campo obrigatório", async () => {
    const res = await request(app)
      .post("/api/solicitacoes")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send({ prioridade: "baixa" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("400 — item sem descricao", async () => {
    const res = await request(app)
      .post("/api/solicitacoes")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send({
        itens: [{ quantidade: 5, unidade: "un" }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("400 — prioridade inválida", async () => {
    const res = await request(app)
      .post("/api/solicitacoes")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send({
        itens: [{ descricao: "item", quantidade: 1, unidade: "un" }],
        prioridade: "extrema",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/solicitacoes — listagem
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/solicitacoes", () => {
  test("200 — admin lista todas as solicitações", async () => {
    const res = await request(app)
      .get("/api/solicitacoes")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data).toBeDefined();
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });

  test("200 — encarregado vê apenas as próprias", async () => {
    const res = await request(app)
      .get("/api/solicitacoes")
      .set("Authorization", `Bearer ${encarregadoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Todos os itens devem pertencer ao encarregado (id=3)
    for (const sol of res.body.data.data) {
      expect(sol.solicitante).toBe(3);
    }
  });

  test("200 — filtro por status", async () => {
    const res = await request(app)
      .get("/api/solicitacoes?status=pendente")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("200 — paginação respeitada", async () => {
    const res = await request(app)
      .get("/api/solicitacoes?page=1&limit=5")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.limit).toBe(5);
    expect(res.body.data.page).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/solicitacoes/:id — por ID
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/solicitacoes/:id", () => {
  let createdId;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/solicitacoes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(solicitacaoValida);
    createdId = res.body.data.id;
  });

  test("200 — retorna solicitação existente", async () => {
    const res = await request(app)
      .get(`/api/solicitacoes/${createdId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdId);
  });

  test("404 — ID inexistente", async () => {
    const res = await request(app)
      .get("/api/solicitacoes/999999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/solicitacoes/:id/aprovar
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/solicitacoes/:id/aprovar", () => {
  let solId;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/solicitacoes")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send(solicitacaoValida);
    solId = res.body.data.id;
  });

  test("403 — encarregado não pode aprovar", async () => {
    const res = await request(app)
      .post(`/api/solicitacoes/${solId}/aprovar`)
      .set("Authorization", `Bearer ${encarregadoToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("200 — supervisor aprova com sucesso", async () => {
    const res = await request(app)
      .post(`/api/solicitacoes/${solId}/aprovar`)
      .set("Authorization", `Bearer ${supervisorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("aprovada");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/solicitacoes/:id/rejeitar
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/solicitacoes/:id/rejeitar", () => {
  let solId;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/solicitacoes")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send(solicitacaoValida);
    solId = res.body.data.id;
  });

  test("403 — encarregado não pode rejeitar", async () => {
    const res = await request(app)
      .post(`/api/solicitacoes/${solId}/rejeitar`)
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send({ motivoRejeicao: "Sem orçamento" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("200 — admin rejeita com motivo", async () => {
    const res = await request(app)
      .post(`/api/solicitacoes/${solId}/rejeitar`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ motivoRejeicao: "Sem orçamento disponível" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("rejeitada");
  });
});
