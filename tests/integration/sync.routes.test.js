/**
 * Testes de integração — Rotas /api/sync
 *
 * Cobre:
 *  - GET  /api/sync/pending
 *  - POST /api/sync/push
 *  - POST /api/sync/conflicts
 *  - POST /api/sync/retry
 */

const request = require("supertest");
const { makeToken } = require("../helpers/auth");
const {
  setupFullDb,
  teardownFullDb,
  getFullDb,
} = require("../helpers/fullDatabase");

jest.mock("../../src/config/database", () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  isConnected: jest.fn().mockReturnValue(true),
  get knex() {
    return require("../helpers/fullDatabase").getFullDb();
  },
}));

jest.mock("../../src/config/supabaseClient", () => {
  const { createSupabaseMock } = require("../helpers/supabaseMock");
  const mock = createSupabaseMock(() =>
    require("../helpers/fullDatabase").getFullDb(),
  );
  mock.createUserClient = jest.fn().mockReturnValue(mock);
  return mock;
});

const app = require("../../src/app");
const syncService = require("../../src/services/SyncService");

beforeAll(async () => {
  await setupFullDb();
  const db = getFullDb();

  await db("users").insert([
    {
      id: 1,
      nome: "Admin Sync",
      email: "admin@sync.com",
      senha: "hash",
      perfil: "admin",
      isActive: true,
    },
    {
      id: 2,
      nome: "Encarregado Sync",
      email: "enc@sync.com",
      senha: "hash",
      perfil: "encarregado",
      isActive: true,
    },
  ]);

  await db("obras").insert([
    {
      id: 1,
      nome: "Obra Sync",
      codigo: "SYNC-001",
      status: "em_andamento",
      responsavel: 1,
    },
  ]);

  await db("obra_encarregados").insert([
    {
      obraId: 1,
      userId: 2,
      funcao: "encarregado",
      dataInclusao: new Date().toISOString(),
    },
  ]);

  await db("medicoes").insert([
    {
      id: 1,
      obra: 1,
      responsavel: 2,
      area: "Sala",
      tipoServico: "alvenaria",
      itens: JSON.stringify([
        {
          descricao: "Bloco",
          quantidade: 10,
          unidade: "un",
          valorUnitario: 5,
        },
      ]),
      status: "enviada",
      syncId: "med-pending-1",
      clientTimestamp: new Date().toISOString(),
      metadata: JSON.stringify({ createdAt: new Date().toISOString() }),
    },
    {
      id: 2,
      obra: 1,
      responsavel: 2,
      area: "Cozinha",
      tipoServico: "pintura",
      itens: JSON.stringify([
        {
          descricao: "Tinta",
          quantidade: 2,
          unidade: "l",
          valorUnitario: 30,
        },
      ]),
      status: "enviada",
      syncId: "med-conflict-1",
      clientTimestamp: new Date().toISOString(),
      metadata: JSON.stringify({ updatedAt: new Date().toISOString() }),
    },
  ]);

  await db("diarios").insert([
    {
      id: 1,
      obra: 1,
      responsavel: 2,
      data: new Date().toISOString(),
      atividades: JSON.stringify([{ descricao: "Atividade pendente" }]),
      syncId: "dia-pending-1",
      clientTimestamp: new Date().toISOString(),
      metadata: JSON.stringify({ createdAt: new Date().toISOString() }),
    },
  ]);

  await db("solicitacoes_compra").insert([
    {
      id: 1,
      obra: 1,
      solicitante: 2,
      itens: JSON.stringify([{ descricao: "Cimento", quantidade: 5, unidade: "un" }]),
      status: "pendente",
      syncId: "sol-pending-1",
      clientTimestamp: new Date().toISOString(),
      metadata: JSON.stringify({ createdAt: new Date().toISOString() }),
    },
  ]);

  await db("arquivos").insert([
    {
      id: 1,
      nome: "foto.jpg",
      nomeOriginal: "foto.jpg",
      tipo: "foto_obra",
      tipoArquivo: "foto_obra",
      mimeType: "image/jpeg",
      tamanho: 1234,
      obra: 1,
      uploadedBy: 2,
      syncId: "arq-pending-1",
      metadata: JSON.stringify({ createdAt: new Date().toISOString() }),
    },
  ]);
});

afterAll(async () => {
  await teardownFullDb();
});

const adminToken = makeToken({ id: 1, perfil: "admin" });
const encarregadoToken = makeToken({ id: 2, perfil: "encarregado" });

describe("GET /api/sync/pending", () => {
  test("401 — sem autenticação", async () => {
    const res = await request(app).get("/api/sync/pending");
    expect(res.status).toBe(401);
  });

  test("200 — retorna pendências e paginação", async () => {
    const res = await request(app)
      .get("/api/sync/pending?limit=10&page=1")
      .set("Authorization", `Bearer ${encarregadoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.medicoes)).toBe(true);
    expect(Array.isArray(res.body.data.diarios)).toBe(true);
    expect(Array.isArray(res.body.data.solicitacoes)).toBe(true);
    expect(Array.isArray(res.body.data.arquivos)).toBe(true);
    expect(res.body.data.pagination).toEqual({ page: 1, limit: 10 });
  });
});

describe("POST /api/sync/push", () => {
  test("400 — payload inválido sem syncId/clientTimestamp", async () => {
    const res = await request(app)
      .post("/api/sync/push")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send({ medicoes: [{}] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("200 — sincroniza lote válido", async () => {
    const now = new Date().toISOString();
    const res = await request(app)
      .post("/api/sync/push")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send({
        medicoes: [
          {
            syncId: "med-new-1",
            clientTimestamp: now,
            obra: 1,
            area: "Quarto",
            tipoServico: "alvenaria",
            itens: [
              {
                descricao: "Bloco cerâmico",
                quantidade: 20,
                unidade: "un",
                valorUnitario: 4,
              },
            ],
            status: "enviada",
          },
        ],
        diarios: [
          {
            syncId: "dia-new-1",
            clientTimestamp: now,
            obra: 1,
            data: now,
            atividades: [{ descricao: "Serviço diário" }],
          },
        ],
        solicitacoes: [
          {
            syncId: "sol-new-1",
            clientTimestamp: now,
            obra: 1,
            itens: [{ descricao: "Areia", quantidade: 3, unidade: "m³" }],
            status: "pendente",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.success)).toBe(true);
    expect(res.body.data.success.length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(res.body.data.errors)).toBe(true);
    expect(Array.isArray(res.body.data.conflicts)).toBe(true);
  });

  test("200 — não atualiza lastSync quando o lote tem erros", async () => {
    const db = getFullDb();
    const before = await db("users").where({ id: 2 }).first();

    const res = await request(app)
      .post("/api/sync/push")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send({
        medicoes: [
          {
            syncId: "med-invalid-obra-1",
            clientTimestamp: new Date().toISOString(),
            obra: 99999,
            area: "Inexistente",
            tipoServico: "alvenaria",
            itens: [{ descricao: "Item", quantidade: 1, unidade: "un" }],
            status: "enviada",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.errors.length).toBeGreaterThanOrEqual(1);

    const after = await db("users").where({ id: 2 }).first();
    expect(after.lastSync || null).toEqual(before.lastSync || null);
  });
});

describe("POST /api/sync/conflicts", () => {
  test("200 — detecta conflito de medição por syncId", async () => {
    const oldTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post("/api/sync/conflicts")
      .set("Authorization", `Bearer ${encarregadoToken}`)
      .send({
        medicoes: [
          {
            syncId: "med-conflict-1",
            clientTimestamp: oldTimestamp,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].type).toBe("medicao");
    expect(res.body.data[0].syncId).toBe("med-conflict-1");
  });
});

describe("POST /api/sync/retry", () => {
  test("401 — sem autenticação", async () => {
    const res = await request(app).post("/api/sync/retry").send({ medicoes: [] });
    expect(res.status).toBe(401);
  });

  test("200 — executa retry de lote válido", async () => {
    const res = await request(app)
      .post("/api/sync/retry")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        medicoes: [
          {
            syncId: "med-retry-1",
            clientTimestamp: new Date().toISOString(),
            obra: 1,
            area: "Varanda",
            tipoServico: "pintura",
            itens: [{ descricao: "Massa corrida", quantidade: 1, unidade: "un" }],
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.success.length).toBeGreaterThanOrEqual(1);
  });

  test("200 — retry reprocessa item após falha transitória", async () => {
    const originalSyncMedicao = syncService.syncMedicao.bind(syncService);
    const targetSyncId = "med-retry-transient-1";

    const spy = jest
      .spyOn(syncService, "syncMedicao")
      .mockImplementation(async (medicaoData, userId, userPerfil) => {
        if (medicaoData.syncId === targetSyncId) {
          spy.mockImplementation(originalSyncMedicao);
          throw new Error("Falha transitória de conexão");
        }

        return originalSyncMedicao(medicaoData, userId, userPerfil);
      });

    const res = await request(app)
      .post("/api/sync/retry")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        medicoes: [
          {
            syncId: targetSyncId,
            clientTimestamp: new Date().toISOString(),
            obra: 1,
            area: "Área retry transitório",
            tipoServico: "pintura",
            itens: [{ descricao: "Massa", quantidade: 1, unidade: "un" }],
            status: "enviada",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attempts).toBeGreaterThanOrEqual(2);
    expect(res.body.data.errors).toEqual([]);
    expect(res.body.data.success.length).toBeGreaterThanOrEqual(1);

    spy.mockRestore();
  });
});
