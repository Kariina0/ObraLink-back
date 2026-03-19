/**
 * Testes de integração de rotas de rascunhos (com mocks determinísticos).
 * Objetivo: validar contratos HTTP das rotas sem depender de banco/tokens reais.
 */

jest.mock("../../src/middleware/auth", () => {
  const { UnauthorizedError, ForbiddenError } = require("../../src/utils/errors");

  const tokenUsers = {
    "admin-token": { id: 1, perfil: "admin", email: "admin@test.com", obraAtual: 1 },
    "supervisor-token": { id: 2, perfil: "supervisor", email: "supervisor@test.com", obraAtual: 1 },
    "encarregado-token": { id: 3, perfil: "encarregado", email: "encarregado@test.com", obraAtual: 1 },
    "encarregado-2-token": { id: 4, perfil: "encarregado", email: "encarregado2@test.com", obraAtual: 1 },
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

jest.mock("../../src/services/MedicaoService", () => {
  const sample = {
    id: 101,
    obra: 1,
    responsavel: 3,
    status: "rascunho",
    area: "sala",
    tipoServico: "pintura",
    data: new Date().toISOString(),
    itens: [],
    anexos: [],
  };

  const listResult = {
    data: [sample],
    total: 1,
    statusSummary: {
      enviada: 0,
      aprovada: 0,
      rejeitada: 0,
      rascunho: 1,
    },
  };

  return {
    create: jest.fn(async (payload, userId) => ({
      ...sample,
      ...payload,
      id: 999,
      responsavel: userId,
      status: payload.status || "rascunho",
    })),
    getAll: jest.fn(async () => listResult),
    getById: jest.fn(async (id) => ({ ...sample, id: Number(id) })),
    getByObra: jest.fn(async () => listResult),
    getByResponsavel: jest.fn(async (userId, _options, filters = {}) => ({
      ...listResult,
      data: [{ ...sample, responsavel: userId, status: filters.status || "rascunho" }],
    })),
    update: jest.fn(async (id, payload) => ({ ...sample, id: Number(id), ...payload })),
    aprovar: jest.fn(async (id) => ({ ...sample, id: Number(id), status: "aprovada" })),
    rejeitar: jest.fn(async (id, _userId, _perfil, motivoRejeicao) => ({
      ...sample,
      id: Number(id),
      status: "rejeitada",
      motivoRejeicao: motivoRejeicao || null,
    })),
    delete: jest.fn(async () => true),
  };
});

const request = require("supertest");
const app = require("../../src/app");

describe("Rotas de Rascunhos - Integração", () => {
  it("deve bloquear acesso sem token", async () => {
    const response = await request(app).get("/api/measurements/rascunhos");
    expect(response.status).toBe(401);
  });

  it("deve listar rascunhos autenticado", async () => {
    const response = await request(app)
      .get("/api/measurements/rascunhos?page=1&limit=5")
      .set("Authorization", "Bearer encarregado-token");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data[0].status).toBe("rascunho");
  });

  it("deve criar rascunho", async () => {
    const response = await request(app)
      .post("/api/measurements")
      .set("Authorization", "Bearer encarregado-token")
      .send({
        obra: 1,
        area: "sala",
        tipoServico: "pintura",
        itens: [{ descricao: "Item", quantidade: 10, unidade: "m²" }],
        status: "rascunho",
        observacoes: "teste",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("rascunho");
  });

  it("encarregado não acessa GET /api/measurements", async () => {
    const response = await request(app)
      .get("/api/measurements")
      .set("Authorization", "Bearer encarregado-token");

    expect(response.status).toBe(403);
  });

  it("admin acessa GET /api/measurements", async () => {
    const response = await request(app)
      .get("/api/measurements?status=rascunho")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("deve suportar update e delete de medição", async () => {
    const updateResponse = await request(app)
      .put("/api/measurements/101")
      .set("Authorization", "Bearer encarregado-token")
      .send({ status: "enviada" });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.status).toBe("enviada");

    const deleteResponse = await request(app)
      .delete("/api/measurements/101")
      .set("Authorization", "Bearer admin-token");

    expect(deleteResponse.status).toBe(200);
  });
});
