/**
 * Testes de segurança de rotas de medições/rascunhos.
 */

jest.mock("../../src/middleware/auth", () => {
  const { UnauthorizedError, ForbiddenError } = require("../../src/utils/errors");

  const tokenUsers = {
    "admin-token": { id: 1, perfil: "admin", email: "admin@test.com", obraAtual: 1 },
    "supervisor-token": { id: 2, perfil: "supervisor", email: "sup@test.com", obraAtual: 1 },
    "enc1-token": { id: 3, perfil: "encarregado", email: "enc1@test.com", obraAtual: 1 },
    "enc2-token": { id: 4, perfil: "encarregado", email: "enc2@test.com", obraAtual: 1 },
  };

  const authenticate = (req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new UnauthorizedError("Token não fornecido"));
    }

    const token = authHeader.substring(7);
    const user = tokenUsers[token];
    if (!user) {
      return next(new UnauthorizedError("Token inválido ou expirado"));
    }

    req.user = user;
    return next();
  };

  const authorize = (...allowedPerfis) => (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("Usuário não autenticado"));
    }

    if (!allowedPerfis.includes(req.user.perfil)) {
      return next(new ForbiddenError("Você não tem permissão para acessar este recurso"));
    }

    return next();
  };

  return {
    authenticate,
    authorize,
    optionalAuth: (_req, _res, next) => next(),
  };
});

jest.mock("../../src/services/MedicaoService", () => ({
  create: jest.fn(async (payload, userId) => ({ id: 201, ...payload, responsavel: userId })),
  getAll: jest.fn(async () => ({
    data: [{ id: 1, status: "enviada", responsavel: 3 }],
    total: 1,
    statusSummary: { enviada: 1, aprovada: 0, rejeitada: 0, rascunho: 0 },
  })),
  getById: jest.fn(async (id, userId, perfil) => {
    const parsedId = Number(id);
    const ownerId = parsedId === 100 ? 3 : 4;

    if (perfil === "encarregado" && ownerId !== userId) {
      const { ForbiddenError } = require("../../src/utils/errors");
      throw new ForbiddenError("Você não tem permissão para acessar esta medição");
    }

    return { id: parsedId, status: "rascunho", responsavel: ownerId };
  }),
  getByObra: jest.fn(async () => ({ data: [], total: 0, statusSummary: {} })),
  getByResponsavel: jest.fn(async (userId, _opt, filters = {}) => ({
    data: [{ id: 300, status: filters.status || "rascunho", responsavel: userId }],
    total: 1,
    statusSummary: { enviada: 0, aprovada: 0, rejeitada: 0, rascunho: 1 },
  })),
  update: jest.fn(async (id, payload, userId, perfil) => {
    const parsedId = Number(id);
    const ownerId = parsedId === 100 ? 3 : 4;

    if (perfil === "encarregado" && ownerId !== userId) {
      const { ForbiddenError } = require("../../src/utils/errors");
      throw new ForbiddenError("Você não tem permissão para editar esta medição");
    }

    return { id: parsedId, ...payload, responsavel: ownerId, status: payload.status || "rascunho" };
  }),
  aprovar: jest.fn(async (id) => ({ id: Number(id), status: "aprovada" })),
  rejeitar: jest.fn(async (id) => ({ id: Number(id), status: "rejeitada" })),
  delete: jest.fn(async (id, userId, perfil) => {
    const parsedId = Number(id);
    const ownerId = parsedId === 100 ? 3 : 4;

    if (perfil === "encarregado" && ownerId !== userId) {
      const { ForbiddenError } = require("../../src/utils/errors");
      throw new ForbiddenError("Você não tem permissão para excluir esta medição");
    }

    return true;
  }),
}));

const request = require("supertest");
const app = require("../../src/app");

describe("Segurança - rotas de rascunhos", () => {
  it("bloqueia rota protegida sem token", async () => {
    const response = await request(app).get("/api/measurements/rascunhos");
    expect(response.status).toBe(401);
  });

  it("encarregado não lista todas as medições", async () => {
    const response = await request(app)
      .get("/api/measurements")
      .set("Authorization", "Bearer enc1-token");

    expect(response.status).toBe(403);
  });

  it("supervisor lista todas as medições", async () => {
    const response = await request(app)
      .get("/api/measurements")
      .set("Authorization", "Bearer supervisor-token");

    expect(response.status).toBe(200);
  });

  it("encarregado acessa próprio rascunho", async () => {
    const response = await request(app)
      .get("/api/measurements/100")
      .set("Authorization", "Bearer enc1-token");

    expect(response.status).toBe(200);
    expect(response.body.data.responsavel).toBe(3);
  });

  it("encarregado não acessa rascunho de outro", async () => {
    const response = await request(app)
      .get("/api/measurements/101")
      .set("Authorization", "Bearer enc1-token");

    expect(response.status).toBe(403);
  });

  it("encarregado não atualiza rascunho de outro", async () => {
    const response = await request(app)
      .put("/api/measurements/101")
      .set("Authorization", "Bearer enc1-token")
      .send({ observacoes: "x" });

    expect(response.status).toBe(403);
  });

  it("encarregado não remove rascunho de outro", async () => {
    const response = await request(app)
      .delete("/api/measurements/101")
      .set("Authorization", "Bearer enc1-token");

    expect(response.status).toBe(403);
  });

  it("admin consegue remover qualquer rascunho", async () => {
    const response = await request(app)
      .delete("/api/measurements/101")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
  });
});
