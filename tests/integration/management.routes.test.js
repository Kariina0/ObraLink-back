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
const supervisorToken = makeToken({ id: 2, perfil: "supervisor" });
const encarregadoToken = makeToken({ id: 3, perfil: "encarregado" });

beforeAll(async () => {
  await setupFullDb();
  const db = getFullDb();

  await db("users").insert([
    { id: 1, nome: "Admin", email: "admin@mgmt.com", senha: "hash", perfil: "admin", isActive: true },
    { id: 2, nome: "Sup", email: "sup@mgmt.com", senha: "hash", perfil: "supervisor", isActive: true },
    { id: 3, nome: "Enc", email: "enc@mgmt.com", senha: "hash", perfil: "encarregado", isActive: true },
  ]);

  await db("obras").insert([
    {
      id: 1,
      nome: "Obra Financeira A",
      codigo: "FIN-A",
      status: "em_andamento",
      orcamento: JSON.stringify({ valor: 100000, valorGasto: 85000 }),
      metadata: JSON.stringify({ createdAt: new Date().toISOString() }),
    },
    {
      id: 2,
      nome: "Obra Financeira B",
      codigo: "FIN-B",
      status: "planejamento",
      orcamento: JSON.stringify({ valor: 120000, valorGasto: 20000 }),
      metadata: JSON.stringify({ createdAt: new Date().toISOString() }),
    },
  ]);

  await db("medicoes").insert([
    {
      obra: 1,
      responsavel: 3,
      status: "aprovada",
      data: new Date().toISOString(),
      itens: JSON.stringify([{ descricao: "Servico A", quantidade: 10, unidade: "m²", valorUnitario: 500 }]),
      metadata: JSON.stringify({ createdAt: new Date().toISOString() }),
    },
    {
      obra: 2,
      responsavel: 3,
      status: "aprovada",
      data: new Date().toISOString(),
      itens: JSON.stringify([{ descricao: "Servico B", quantidade: 5, unidade: "m²", valorUnitario: 600 }]),
      metadata: JSON.stringify({ createdAt: new Date().toISOString() }),
    },
  ]);

  await db("solicitacoes_compra").insert([
    {
      obra: 1,
      solicitante: 3,
      status: "pendente",
      itens: JSON.stringify([{ descricao: "Cimento", quantidade: 20, unidade: "un", valorUnitario: 30 }]),
      prioridade: "alta",
      metadata: JSON.stringify({ createdAt: new Date().toISOString() }),
    },
  ]);
});

afterAll(async () => {
  await teardownFullDb();
});

describe("GET /api/management/overview", () => {
  test("401 sem autenticação", async () => {
    const res = await request(app).get("/api/management/overview");
    expect(res.status).toBe(401);
  });

  test("403 encarregado sem permissão", async () => {
    const res = await request(app)
      .get("/api/management/overview")
      .set("Authorization", `Bearer ${encarregadoToken}`);

    expect(res.status).toBe(403);
  });

  test("200 admin recebe visão gerencial com obras e resumo", async () => {
    const res = await request(app)
      .get("/api/management/overview?periodo=30")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.obras)).toBe(true);
    expect(res.body.data.obras.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.resumoGeral.totalOrcado).toBeGreaterThan(0);
  });

  test("200 supervisor também tem acesso", async () => {
    const res = await request(app)
      .get("/api/management/overview")
      .set("Authorization", `Bearer ${supervisorToken}`);

    expect(res.status).toBe(200);
  });
});

describe("Exportações gerenciais", () => {
  test("CSV de obras retorna attachment csv", async () => {
    const res = await request(app)
      .get("/api/management/exports/obras.csv")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("Obra");
  });

  test("CSV de medições retorna attachment csv", async () => {
    const res = await request(app)
      .get("/api/management/exports/medicoes.csv?mes=2026-03")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("ID");
  });

  test("PDF de boletim retorna application/pdf", async () => {
    const res = await request(app)
      .get("/api/management/exports/boletim.pdf?mes=2026-03")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
  });
});
