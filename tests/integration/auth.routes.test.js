/**
 * Testes de integração — Rotas /api/auth
 *
 * Cobre:
 *  - POST /api/auth/register  (admin-only: sucesso, 401 sem token, 403 perfil incorreto, email duplicado, dados inválidos)
 *  - POST /api/auth/login     (sucesso, credenciais erradas, usuário inativo)
 *  - POST /api/auth/refresh   (token válido, token inválido)
 *  - POST /api/auth/logout    (com e sem autenticação)
 *  - POST /api/auth/change-password (sucesso, senha atual errada)
 *  - GET  /api/auth/me        (com e sem autenticação)
 */

const request = require("supertest");
const bcrypt = require("bcryptjs");
const { setupTestDb, teardownTestDb, getTestDb } = require("../helpers/database");
const { makeToken, adminToken, encarregadoToken } = require("../helpers/auth");
const jwt = require("jsonwebtoken");

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("../../src/config/database", () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  isConnected: jest.fn().mockReturnValue(true),
  get knex() {
    return require("../helpers/database").getTestDb();
  },
}));

// ── App (after mocks) ─────────────────────────────────────────────────────────
const app = require("../../src/app");

// ── Setup / Teardown ──────────────────────────────────────────────────────────
beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function createUser(overrides = {}) {
  const db = getTestDb();
  const senha = await bcrypt.hash("senha123", 12);
  const defaults = {
    nome: "Usuario Teste",
    email: `test_${Date.now()}@construcao.com`,
    senha,
    perfil: "encarregado",
    isActive: true,
  };
  const [id] = await db("users").insert({ ...defaults, ...overrides });
  return db("users").where({ id }).first();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Health check
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/health", () => {
  test("retorna 200 com status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Register — acesso exclusivo ADMIN
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/auth/register", () => {
  test("401 — sem token (acesso público bloqueado)", async () => {
    const res = await request(app).post("/api/auth/register").send({
      nome: "Sem Token",
      email: `semtoken_${Date.now()}@construcao.com`,
      senha: "senha123",
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("403 — token de encarregado é rejeitado", async () => {
    const user = await createUser({ perfil: "encarregado" });
    const token = makeToken({ id: user.id, perfil: "encarregado" });

    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nome: "Tentativa Encarregado",
        email: `enc_${Date.now()}@construcao.com`,
        senha: "senha123",
      });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("403 — token de supervisor é rejeitado", async () => {
    const user = await createUser({ perfil: "supervisor" });
    const token = makeToken({ id: user.id, perfil: "supervisor" });

    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nome: "Tentativa Supervisor",
        email: `sup_${Date.now()}@construcao.com`,
        senha: "senha123",
      });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("201 — admin cria usuário encarregado com sucesso", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        nome: "Novo Encarregado",
        email: `encarregado_${Date.now()}@construcao.com`,
        senha: "Senha123A",  // política: mínimo 8 chars, maiúscula, número
        perfil: "encarregado",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.perfil).toBe("encarregado");
    // tokens não devem ser retornados no cadastro admin
    expect(res.body.data.accessToken).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();
    // senha não deve aparecer na resposta
    expect(res.body.data.user.senha).toBeUndefined();
  });

  test("201 — admin cria usuário supervisor com sucesso", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        nome: "Novo Supervisor",
        email: `supervisor_${Date.now()}@construcao.com`,
        senha: "Senha123A",  // política: mínimo 8 chars, maiúscula, número
        perfil: "supervisor",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.perfil).toBe("supervisor");
  });

  test("409 — email já cadastrado", async () => {
    const email = `dup_${Date.now()}@construcao.com`;
    await createUser({ email });

    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        nome: "Duplicado",
        email,
        senha: "Senha123A",  // política: mínimo 8 chars, maiúscula, número
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test("400 — nome ausente", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "semNome@construcao.com",
        senha: "senha123",
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("400 — email inválido", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        nome: "Usuario",
        email: "nao_e_email",
        senha: "senha123",
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("400 — senha com menos de 6 caracteres", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        nome: "Usuario",
        email: "short@construcao.com",
        senha: "123",
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("400 — perfil inválido é rejeitado", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        nome: "Usuario",
        email: `perfil_${Date.now()}@construcao.com`,
        senha: "senha123",
        perfil: "hacker",
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Login
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/auth/login", () => {
  test("200 — login com credenciais corretas", async () => {
    const email = `login_${Date.now()}@construcao.com`;
    await createUser({ email });

    const res = await request(app).post("/api/auth/login").send({
      email,
      senha: "senha123",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe(email);
    // senha não deve aparecer
    expect(res.body.data.user.senha).toBeUndefined();
  });

  test("401 — senha incorreta", async () => {
    const email = `wrongpw_${Date.now()}@construcao.com`;
    await createUser({ email });

    const res = await request(app).post("/api/auth/login").send({
      email,
      senha: "senhaErrada",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("401 — email inexistente", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "inexistente@construcao.com",
      senha: "senha123",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("401 — usuário inativo", async () => {
    const email = `inativo_${Date.now()}@construcao.com`;
    await createUser({ email, isActive: false });

    const res = await request(app).post("/api/auth/login").send({
      email,
      senha: "senha123",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("400 — email ausente", async () => {
    const res = await request(app).post("/api/auth/login").send({ senha: "senha123" });
    expect(res.status).toBe(400);
  });

  test("400 — senha ausente", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "x@x.com" });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/auth/me
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/auth/me", () => {
  test("401 — sem token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("401 — token inválido", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer token_invalido");
    expect(res.status).toBe(401);
  });

  test("200 — retorna dados do usuário atual", async () => {
    const email = `me_${Date.now()}@construcao.com`;
    const user = await createUser({ email });
    const token = makeToken({ id: user.id, perfil: "encarregado" });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(email);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/logout
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/auth/logout", () => {
  test("401 — sem token", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(401);
  });

  test("200 — logout realizado com sucesso", async () => {
    const email = `logout_${Date.now()}@construcao.com`;
    const user = await createUser({ email });
    const token = makeToken({ id: user.id, perfil: "encarregado" });

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/refresh
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/auth/refresh", () => {
  test("401 — sem refreshToken no body", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});
    expect(res.status).toBe(401);
  });

  test("401 — refreshToken inválido", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "token_invalido_qualquer" });
    expect(res.status).toBe(401);
  });

  test("200 — renova tokens com refreshToken válido", async () => {
    // Primeiro faz login para obter refresh token real
    const email = `refresh_${Date.now()}@construcao.com`;
    await createUser({ email });

    const loginRes = await request(app).post("/api/auth/login").send({
      email,
      senha: "senha123",
    });

    expect(loginRes.status).toBe(200);
    const { refreshToken } = loginRes.body.data;

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/change-password
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/auth/change-password", () => {
  test("401 — sem autenticação", async () => {
    const res = await request(app).post("/api/auth/change-password").send({
      senhaAtual: "senha123",
      novaSenha: "novaSenha456",
    });
    expect(res.status).toBe(401);
  });

  test("400 — senha atual incorreta", async () => {
    const email = `changepw_${Date.now()}@construcao.com`;
    const user = await createUser({ email });
    const token = makeToken({ id: user.id, perfil: "encarregado" });

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ senhaAtual: "senhaErrada999", novaSenha: "novaSenha456" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("200 — altera senha com sucesso", async () => {
    const email = `changepw2_${Date.now()}@construcao.com`;
    const user = await createUser({ email });
    const token = makeToken({ id: user.id, perfil: "encarregado" });

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ senhaAtual: "senha123", novaSenha: "novaSenha456" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("400 — nova senha muito curta", async () => {
    const email = `changepw3_${Date.now()}@construcao.com`;
    const user = await createUser({ email });
    const token = makeToken({ id: user.id, perfil: "encarregado" });

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ senhaAtual: "senha123", novaSenha: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Rota inexistente → 404
// ═══════════════════════════════════════════════════════════════════════════════
describe("Rota inexistente", () => {
  test("404 em rota não mapeada", async () => {
    const res = await request(app).get("/api/rota_que_nao_existe");
    expect(res.status).toBe(404);
  });
});
