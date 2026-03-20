const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { setupTestDb, teardownTestDb, getTestDb } = require("../helpers/database");
const { makeToken } = require("../helpers/auth");

process.env.ALLOWED_ORIGINS = "http://localhost:3000";
process.env.LOGIN_RATE_LIMIT_MAX = "2";
process.env.REFRESH_RATE_LIMIT_MAX = "2";

jest.mock("../../src/config/database", () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  isConnected: jest.fn().mockReturnValue(true),
  get knex() {
    return require("../helpers/database").getTestDb();
  },
}));

jest.mock("../../src/config/supabaseClient", () => {
  const { createSupabaseMock } = require("../helpers/supabaseMock");
  const mock = createSupabaseMock(() => require("../helpers/database").getTestDb());
  mock.createUserClient = jest.fn().mockReturnValue(mock);
  return mock;
});

const app = require("../../src/app");

beforeAll(async () => {
  await setupTestDb();

  const db = getTestDb();
  const senha = await bcrypt.hash("Senha123A", 12);

  await db("users").insert([
    {
      id: 10,
      nome: "Admin Seg",
      email: "admin.seg@obralink.com",
      senha,
      perfil: "admin",
      isActive: true,
    },
    {
      id: 11,
      nome: "Supervisor Seg",
      email: "sup.seg@obralink.com",
      senha,
      perfil: "supervisor",
      isActive: true,
    },
    {
      id: 12,
      nome: "Encarregado Seg",
      email: "enc.seg@obralink.com",
      senha,
      perfil: "encarregado",
      isActive: true,
    },
  ]);
});

afterAll(async () => {
  await teardownTestDb();
});

describe("Auth security hardening", () => {
  test("login não expõe senha/hash e retorna tokens", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.seg@obralink.com", senha: "Senha123A" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.senha).toBeUndefined();
    expect(res.body.data.user.refreshToken).toBeUndefined();
  });

  test("token expirado é rejeitado em /api/auth/me", async () => {
    const expiredToken = jwt.sign(
      { id: 10, email: "admin.seg@obralink.com", perfil: "admin" },
      process.env.JWT_SECRET || "dev_jwt_secret_change_me",
      { expiresIn: "-10s", algorithm: "HS256" },
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("logout invalida refresh token", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.seg@obralink.com", senha: "Senha123A" });

    expect(login.status).toBe(200);

    const accessToken = login.body.data.accessToken;
    const refreshToken = login.body.data.refreshToken;

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(logout.status).toBe(200);

    const refreshAfterLogout = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(refreshAfterLogout.status).toBe(401);
    expect(refreshAfterLogout.body.success).toBe(false);
  });

  test("RBAC: encarregado não acessa /api/auth/users", async () => {
    const encToken = makeToken({
      id: 12,
      perfil: "encarregado",
      email: "enc.seg@obralink.com",
    });

    const res = await request(app)
      .get("/api/auth/users")
      .set("Authorization", `Bearer ${encToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("RBAC: supervisor acessa /api/auth/users", async () => {
    const supToken = makeToken({
      id: 11,
      perfil: "supervisor",
      email: "sup.seg@obralink.com",
    });

    const res = await request(app)
      .get("/api/auth/users")
      .set("Authorization", `Bearer ${supToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test("rate limit de login dispara 429 após limite", async () => {
    const ip = "10.10.10.10";

    const req1 = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", ip)
      .send({ email: "admin.seg@obralink.com", senha: "senha_errada" });

    const req2 = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", ip)
      .send({ email: "admin.seg@obralink.com", senha: "senha_errada" });

    const req3 = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", ip)
      .send({ email: "admin.seg@obralink.com", senha: "senha_errada" });

    expect(req1.status).toBe(401);
    expect(req2.status).toBe(401);
    expect(req3.status).toBe(429);
  });

  test("rate limit de refresh dispara 429 após limite", async () => {
    const badToken = "refresh.token.invalido";
    const ip = "10.10.10.11";

    const req1 = await request(app)
      .post("/api/auth/refresh")
      .set("X-Forwarded-For", ip)
      .send({ refreshToken: badToken });

    const req2 = await request(app)
      .post("/api/auth/refresh")
      .set("X-Forwarded-For", ip)
      .send({ refreshToken: badToken });

    const req3 = await request(app)
      .post("/api/auth/refresh")
      .set("X-Forwarded-For", ip)
      .send({ refreshToken: badToken });

    expect(req1.status).toBe(401);
    expect(req2.status).toBe(401);
    expect(req3.status).toBe(429);
  });

  test("CORS bloqueia origin não permitida com 403", async () => {
    const res = await request(app)
      .get("/health")
      .set("Origin", "https://evil.example");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("CORS permite origin autorizada", async () => {
    const res = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(200);
  });
});
