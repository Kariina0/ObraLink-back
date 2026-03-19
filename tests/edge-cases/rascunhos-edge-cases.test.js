/**
 * Edge cases de rascunhos com foco em estabilidade de contrato HTTP.
 */

jest.mock("../../src/middleware/auth", () => {
  const { UnauthorizedError, ForbiddenError } = require("../../src/utils/errors");

  const tokenUsers = {
    "admin-token": { id: 1, perfil: "admin", email: "admin@test.com", obraAtual: 1 },
    "enc-token": { id: 2, perfil: "encarregado", email: "enc@test.com", obraAtual: 1 },
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
  let nextId = 900;
  const registros = new Map();

  const build = (id, responsavel, payload = {}) => ({
    id,
    obra: payload.obra ?? 1,
    responsavel,
    status: payload.status ?? "rascunho",
    observacoes: payload.observacoes ?? null,
    comprimento: payload.comprimento ?? null,
    largura: payload.largura ?? null,
    altura: payload.altura ?? null,
    createdAt: payload.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return {
    create: jest.fn(async (payload, userId) => {
      const id = ++nextId;
      const item = build(id, userId, payload);
      registros.set(id, item);
      return item;
    }),
    getAll: jest.fn(async () => ({
      data: Array.from(registros.values()),
      total: registros.size,
      statusSummary: { enviada: 0, aprovada: 0, rejeitada: 0, rascunho: registros.size },
    })),
    getById: jest.fn(async (id, userId, perfil) => {
      const item = registros.get(Number(id)) || build(Number(id), userId);
      if (perfil === "encarregado" && item.responsavel !== userId) {
        const { ForbiddenError } = require("../../src/utils/errors");
        throw new ForbiddenError("Você não tem permissão para acessar esta medição");
      }
      return item;
    }),
    getByObra: jest.fn(async () => ({ data: Array.from(registros.values()), total: registros.size, statusSummary: {} })),
    getByResponsavel: jest.fn(async (userId, options = {}, filters = {}) => {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const all = Array.from(registros.values()).filter((item) => item.responsavel === userId);
      const filtered = filters.status ? all.filter((item) => item.status === filters.status) : all;
      return {
        data: filtered.slice(0, limit),
        total: filtered.length,
        statusSummary: { enviada: 0, aprovada: 0, rejeitada: 0, rascunho: filtered.length },
      };
    }),
    update: jest.fn(async (id, payload, userId, perfil) => {
      const key = Number(id);
      const item = registros.get(key) || build(key, userId);

      if (perfil === "encarregado" && item.responsavel !== userId) {
        const { ForbiddenError } = require("../../src/utils/errors");
        throw new ForbiddenError("Você não tem permissão para editar esta medição");
      }

      const updated = {
        ...item,
        ...payload,
        id: key,
        updatedAt: new Date().toISOString(),
      };
      registros.set(key, updated);
      return updated;
    }),
    aprovar: jest.fn(async (id) => ({ id: Number(id), status: "aprovada" })),
    rejeitar: jest.fn(async (id) => ({ id: Number(id), status: "rejeitada" })),
    delete: jest.fn(async (id, userId, perfil) => {
      const key = Number(id);
      const item = registros.get(key);
      if (item && perfil === "encarregado" && item.responsavel !== userId) {
        const { ForbiddenError } = require("../../src/utils/errors");
        throw new ForbiddenError("Você não tem permissão para excluir esta medição");
      }
      registros.delete(key);
      return true;
    }),
  };
});

const request = require("supertest");
const app = require("../../src/app");

describe("Edge cases - rascunhos", () => {
  it("deve criar rascunho com payload mínimo", async () => {
    const response = await request(app)
      .post("/api/measurements")
      .set("Authorization", "Bearer enc-token")
      .send({
        obra: 1,
        area: "sala",
        tipoServico: "pintura",
        itens: [{ descricao: "Item", quantidade: 5, unidade: "m²" }],
        status: "rascunho",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("rascunho");
  });

  it("deve atualizar parcialmente um rascunho", async () => {
    const created = await request(app)
      .post("/api/measurements")
      .set("Authorization", "Bearer enc-token")
      .send({
        obra: 1,
        area: "sala",
        tipoServico: "pintura",
        itens: [{ descricao: "Item", quantidade: 2, unidade: "m²" }],
        status: "rascunho",
        observacoes: "orig",
      });

    const updated = await request(app)
      .put(`/api/measurements/${created.body.data.id}`)
      .set("Authorization", "Bearer enc-token")
      .send({ observacoes: "novo valor" });

    expect(updated.status).toBe(200);
    expect(updated.body.data.observacoes).toBe("novo valor");
  });

  it("deve suportar paginação alta em rascunhos", async () => {
    const response = await request(app)
      .get("/api/measurements/rascunhos?page=10&limit=100")
      .set("Authorization", "Bearer enc-token");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("deve converter rascunho para enviada", async () => {
    const created = await request(app)
      .post("/api/measurements")
      .set("Authorization", "Bearer enc-token")
      .send({
        obra: 1,
        area: "quarto",
        tipoServico: "acabamento",
        itens: [{ descricao: "Item", quantidade: 1, unidade: "un" }],
        status: "rascunho",
      });

    const sent = await request(app)
      .put(`/api/measurements/${created.body.data.id}`)
      .set("Authorization", "Bearer enc-token")
      .send({ status: "enviada" });

    expect(sent.status).toBe(200);
    expect(sent.body.data.status).toBe("enviada");
  });

  it("deve manter estabilidade em múltiplas leituras sequenciais", async () => {
    for (let index = 0; index < 5; index += 1) {
      const response = await request(app)
        .get("/api/measurements/minhas?limit=20")
        .set("Authorization", "Bearer enc-token");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    }
  });

  it("deve bloquear acesso com token inválido", async () => {
    const response = await request(app)
      .get("/api/measurements/minhas")
      .set("Authorization", "Bearer token-invalido");

    expect(response.status).toBe(401);
  });
});
