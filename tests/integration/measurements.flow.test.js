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

  mock.rpc = jest.fn(async (fnName) => ({
    data: null,
    error: {
      message: `Could not find the function public.${fnName} in the schema cache`,
    },
  }));

  mock.createUserClient = jest.fn().mockReturnValue(mock);
  return mock;
});

jest.mock("../../src/services/StorageService", () => ({
  isSupabase: jest.fn().mockReturnValue(false),
  upload: jest.fn(),
  getSignedUrl: jest.fn(async () => null),
  delete: jest.fn(async () => undefined),
}));

const app = require("../../src/app");

const adminToken = makeToken({ id: 1, perfil: "admin", email: "admin@flow.com" });
const supervisorToken = makeToken({ id: 2, perfil: "supervisor", email: "sup@flow.com" });
const enc1Token = makeToken({ id: 3, perfil: "encarregado", email: "enc1@flow.com" });
const enc2Token = makeToken({ id: 4, perfil: "encarregado", email: "enc2@flow.com" });

describe("Fluxo real de medições", () => {
  beforeAll(async () => {
    await setupFullDb();
    const db = getFullDb();

    await db("users").insert([
      { id: 1, nome: "Admin", email: "admin@flow.com", senha: "hash", perfil: "admin", isActive: true },
      { id: 2, nome: "Supervisor", email: "sup@flow.com", senha: "hash", perfil: "supervisor", isActive: true },
      { id: 3, nome: "Enc 1", email: "enc1@flow.com", senha: "hash", perfil: "encarregado", isActive: true },
      { id: 4, nome: "Enc 2", email: "enc2@flow.com", senha: "hash", perfil: "encarregado", isActive: true },
    ]);

    await db("obras").insert([
      { id: 1, nome: "Obra Fluxo", codigo: "FLX-001", status: "em_andamento" },
    ]);

    await db("obra_encarregados").insert([
      { obraId: 1, userId: 3, funcao: "encarregado", dataInclusao: new Date().toISOString() },
      { obraId: 1, userId: 4, funcao: "encarregado", dataInclusao: new Date().toISOString() },
    ]);
  });

  afterAll(async () => {
    await teardownFullDb();
  });

  test("cria rascunho, edita rascunho, mantém privacidade e listas corretas", async () => {
    const created = await request(app)
      .post("/api/measurements")
      .set("Authorization", `Bearer ${enc1Token}`)
      .send({
        obra: 1,
        status: "rascunho",
        itens: [{ descricao: "Item base", quantidade: 10, unidade: "m²" }],
        observacoes: "Rascunho inicial",
      });

    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("rascunho");

    const medicaoId = created.body.data.id;

    const updated = await request(app)
      .put(`/api/measurements/${medicaoId}`)
      .set("Authorization", `Bearer ${enc1Token}`)
      .send({ observacoes: "Rascunho editado" });

    expect(updated.status).toBe(200);
    expect(updated.body.data.observacoes).toBe("Rascunho editado");

    const forbidden = await request(app)
      .get(`/api/measurements/${medicaoId}`)
      .set("Authorization", `Bearer ${enc2Token}`);

    expect(forbidden.status).toBe(403);

    const minhas = await request(app)
      .get("/api/measurements/minhas")
      .set("Authorization", `Bearer ${enc1Token}`);

    expect(minhas.status).toBe(200);
    expect(minhas.body.data.find((m) => m.id === medicaoId)).toBeUndefined();

    const rascunhosAutor = await request(app)
      .get("/api/measurements/rascunhos")
      .set("Authorization", `Bearer ${enc1Token}`);

    expect(rascunhosAutor.status).toBe(200);
    expect(
      rascunhosAutor.body.data.find(
        (m) => Number(m.id) === Number(medicaoId),
      ),
    ).toBeDefined();

    const rascunhosOutro = await request(app)
      .get("/api/measurements/rascunhos")
      .set("Authorization", `Bearer ${enc2Token}`);

    expect(rascunhosOutro.status).toBe(200);
    expect(rascunhosOutro.body.data.find((m) => m.id === medicaoId)).toBeUndefined();

    const listagemGeral = await request(app)
      .get("/api/measurements")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(listagemGeral.status).toBe(200);
    expect(listagemGeral.body.data.find((m) => m.id === medicaoId)).toBeUndefined();
  });

  test("não permite enviar medição incompleta e aprova/rejeita corretamente com status persistido", async () => {
    const created = await request(app)
      .post("/api/measurements")
      .set("Authorization", `Bearer ${enc1Token}`)
      .send({
        obra: 1,
        status: "rascunho",
        itens: [{ descricao: "Item envio", quantidade: 5, unidade: "m²" }],
      });

    expect(created.status).toBe(201);
    const medicaoId = created.body.data.id;

    const sendIncomplete = await request(app)
      .put(`/api/measurements/${medicaoId}`)
      .set("Authorization", `Bearer ${enc1Token}`)
      .send({ status: "enviada" });

    expect(sendIncomplete.status).toBe(400);

    const sendValid = await request(app)
      .put(`/api/measurements/${medicaoId}`)
      .set("Authorization", `Bearer ${enc1Token}`)
      .send({
        status: "enviada",
        area: "Sala 01",
        tipoServico: "pintura",
      });

    expect(sendValid.status).toBe(200);
    expect(sendValid.body.data.status).toBe("enviada");

    const tamperApprovalStatus = await request(app)
      .put(`/api/measurements/${medicaoId}`)
      .set("Authorization", `Bearer ${enc1Token}`)
      .send({ status: "aprovada" });

    expect(tamperApprovalStatus.status).toBe(400);

    const approved = await request(app)
      .post(`/api/measurements/${medicaoId}/aprovar`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({});

    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe("aprovada");

    const db = getFullDb();
    const approvedRow = await db("medicoes").where({ id: medicaoId }).first();
    expect(approvedRow.status).toBe("aprovada");
    expect(Number(approvedRow.aprovadoPor)).toBe(2);
    expect(approvedRow.obra).toBe(1);
    expect(Number(approvedRow.responsavel)).toBe(3);
    expect(approvedRow.itens).toBeTruthy();

    const created2 = await request(app)
      .post("/api/measurements")
      .set("Authorization", `Bearer ${enc1Token}`)
      .send({
        obra: 1,
        status: "enviada",
        area: "Corredor",
        tipoServico: "alvenaria",
        itens: [{ descricao: "Item rejeição", quantidade: 2, unidade: "m²" }],
      });

    expect(created2.status).toBe(201);
    const medicaoId2 = created2.body.data.id;

    const rejected = await request(app)
      .post(`/api/measurements/${medicaoId2}/rejeitar`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({ motivoRejeicao: "Medição divergente" });

    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe("rejeitada");
    expect(rejected.body.data.motivoRejeicao).toBe("Medição divergente");

    const rejectedRow = await db("medicoes").where({ id: medicaoId2 }).first();
    expect(rejectedRow.status).toBe("rejeitada");
    expect(rejectedRow.motivoRejeicao).toBe("Medição divergente");
  });
});
