require("dotenv").config();
const http = require("http");

const HOST = process.env.API_HOST || "localhost";
const PORT = Number(process.env.PORT || process.env.API_PORT || 5001);

const ADMIN_EMAIL_CANDIDATES = [
  process.env.TEST_ADMIN_EMAIL,
  process.env.ADMIN_EMAIL,
  "administrador@obralink.com",
  "admin@construcao.com",
  "admin@obralink.com",
].filter(Boolean);

const ADMIN_PASSWORD_CANDIDATES = [
  process.env.TEST_ADMIN_PASSWORD,
  process.env.ADMIN_PASSWORD,
  "admin123",
  "Admin@123",
  "Admin@2025",
].filter(Boolean);

function nowIso() {
  return new Date().toISOString();
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    if (data) headers["Content-Length"] = Buffer.byteLength(data);

    const req = http.request(
      { hostname: HOST, port: PORT, path, method, headers },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function ok(r, label, extra) {
  const pass = r.status >= 200 && r.status < 300;
  console.log(pass ? "✅" : "❌", label, "→ HTTP", r.status, extra || "");
  if (!pass) console.log("   Body:", JSON.stringify(r.body).substring(0, 200));
  return pass;
}

async function loginWithFallbacks() {
  for (const email of ADMIN_EMAIL_CANDIDATES) {
    for (const senha of ADMIN_PASSWORD_CANDIDATES) {
      const result = await request("POST", "/api/auth/login", { email, senha });
      if (result.status === 200 && result.body?.data?.accessToken) {
        return { result, email, senha };
      }
    }
  }

  return { result: null, email: null, senha: null };
}

async function run() {
  console.log("\n===== TESTE DE ROTAS — ObraLink Backend =====\n");
  console.log(`Host: ${HOST}:${PORT}`);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const loginAttempt = await loginWithFallbacks();
  let r = loginAttempt.result;
  if (!r) {
    console.log("❌ POST /api/auth/login → nenhum par de credenciais funcionou");
    console.log("   Dica: defina TEST_ADMIN_EMAIL e TEST_ADMIN_PASSWORD no .env");
    return;
  }

  ok(
    r,
    "POST /api/auth/login",
    `usuario: ${r.body.data?.user?.nome || ""} (${loginAttempt.email})`,
  );

  const token = r.body.data.accessToken;
  const refreshToken = r.body.data.refreshToken;

  r = await request("GET", "/api/auth/me", null, token);
  ok(r, "GET  /api/auth/me", r.body.data?.email || "");

  r = await request("POST", "/api/auth/refresh", { refreshToken });
  ok(r, "POST /api/auth/refresh", r.body.data?.accessToken ? "novo token OK" : "");
  const newToken = r.body.data?.accessToken || token;

  // smoke de autorização
  r = await request("GET", "/api/management/overview", null);
  console.log(r.status === 401 ? "✅" : "❌", "GET  /api/management/overview sem token → HTTP", r.status);

  // ── Obras ─────────────────────────────────────────────────────────────────
  r = await request("GET", "/api/obras", null, newToken);
  ok(r, "GET  /api/obras", "itens: " + (Array.isArray(r.body.data) ? r.body.data.length : "?"));

  const obraCodigo = "OBT-" + Date.now();
  r = await request("POST", "/api/obras", {
    nome: "Obra Teste API",
    codigo: obraCodigo,
    status: "em_andamento",
    dataInicio: "2026-01-01",
  }, newToken);

  const obraId = r.body.data?.id;
  ok(r, "POST /api/obras", r.body.data?.nome || "");

  if (obraId) {
    r = await request("GET", "/api/obras/" + obraId, null, newToken);
    ok(r, "GET  /api/obras/:id", r.body.data?.nome || "");

    r = await request("PUT", "/api/obras/" + obraId, {
      nome: "Obra Teste API Atualizada",
      observacoes: "Atualização automática do script",
      status: "em_andamento",
    }, newToken);
    ok(r, "PUT  /api/obras/:id", r.body.data?.nome || "");

    r = await request("PATCH", "/api/obras/" + obraId + "/status", {
      status: "pausada",
    }, newToken);
    ok(r, "PATCH /api/obras/:id/status", r.body.data?.status || "");
  }

  // ── Medições ──────────────────────────────────────────────────────────────
  r = await request("POST", "/api/measurements", {
    obra: obraId || 1,
    data: nowIso(),
    area: "Area Script",
    tipoServico: "alvenaria",
    itens: [{ descricao: "Laje", quantidade: 10, unidade: "m²", valorUnitario: 100 }],
    status: "rascunho",
  }, newToken);
  const medicaoId = r.body.data?.id;
  ok(r, "POST /api/measurements", r.body.data?.id ? "id: " + r.body.data.id : "");

  r = await request("GET", "/api/measurements", null, newToken);
  ok(r, "GET  /api/measurements", "itens: " + (Array.isArray(r.body.data) ? r.body.data.length : "?"));

  if (medicaoId) {
    r = await request("PUT", "/api/measurements/" + medicaoId, {
      observacoes: "Atualizada pelo script",
      status: "enviada",
      area: "Area Script Atualizada",
      tipoServico: "alvenaria",
      itens: [{ descricao: "Laje", quantidade: 11, unidade: "m²", valorUnitario: 100 }],
    }, newToken);
    ok(r, "PUT  /api/measurements/:id", r.body.data?.status || "");

    r = await request("POST", "/api/measurements/" + medicaoId + "/aprovar", {}, newToken);
    ok(r, "POST /api/measurements/:id/aprovar", r.body.data?.status || "");

    r = await request("DELETE", "/api/measurements/" + medicaoId, null, newToken);
    ok(r, "DELETE /api/measurements/:id", r.body.success ? "soft delete OK" : "");
  }

  // ── Diários ───────────────────────────────────────────────────────────────
  r = await request("POST", "/api/diarios", {
    obra: obraId || 1,
    data: nowIso(),
    clima: "ensolarado",
    atividades: [{ descricao: "Concretagem da laje" }],
  }, newToken);
  const diarioId = r.body.data?.id;
  ok(r, "POST /api/diarios", r.body.data?.id ? "id: " + r.body.data.id : "");

  r = await request("GET", "/api/diarios", null, newToken);
  ok(r, "GET  /api/diarios", "itens: " + (Array.isArray(r.body.data) ? r.body.data.length : "?"));

  if (diarioId) {
    r = await request("GET", "/api/diarios/check?obra=" + (obraId || 1) + "&data=" + nowIso().slice(0, 10), null, newToken);
    ok(r, "GET  /api/diarios/check", "exists: " + (r.body.data?.exists ?? "?"));

    r = await request("PUT", "/api/diarios/" + diarioId, {
      clima: "nublado",
      atividades: [{ descricao: "Atualização de atividades" }],
    }, newToken);
    ok(r, "PUT  /api/diarios/:id", r.body.success ? "update OK" : "");

    r = await request("DELETE", "/api/diarios/" + diarioId, null, newToken);
    ok(r, "DELETE /api/diarios/:id", r.body.success ? "soft delete OK" : "");
  }

  // ── Solicitações ──────────────────────────────────────────────────────────
  r = await request("POST", "/api/solicitacoes", {
    obra: obraId || 1,
    itens: [{ descricao: "Cimento", quantidade: 50, unidade: "sc", valorUnitario: 35 }],
    prioridade: "media",
    justificativa: "Necessário para continuação da obra",
  }, newToken);
  const solId = r.body.data?.id;
  ok(r, "POST /api/solicitacoes", r.body.data?.id ? "id: " + r.body.data.id : "");

  r = await request("GET", "/api/solicitacoes", null, newToken);
  ok(r, "GET  /api/solicitacoes", "total: " + (r.body.data?.total ?? "?"));

  if (solId) {
    r = await request("POST", "/api/solicitacoes/" + solId + "/aprovar", {}, newToken);
    ok(r, "POST /api/solicitacoes/:id/aprovar", r.body.data?.status || "");
  }

  // ── Files (smoke sem upload multipart neste script) ──────────────────────
  r = await request("GET", "/api/files/obra/" + (obraId || 1), null, newToken);
  ok(r, "GET  /api/files/obra/:obraId", "itens: " + (Array.isArray(r.body.data) ? r.body.data.length : "?"));

  r = await request("GET", "/api/files/storage/usage", null, newToken);
  ok(r, "GET  /api/files/storage/usage", r.body.success ? "OK" : "");

  // ── Sync ─────────────────────────────────────────────────────────────────
  r = await request("GET", "/api/sync/pending?limit=10&page=1", null, newToken);
  ok(r, "GET  /api/sync/pending", r.body.success ? "OK" : "");

  r = await request("POST", "/api/sync/push", {
    medicoes: [],
    diarios: [],
    solicitacoes: [],
    arquivos: [],
  }, newToken);
  ok(r, "POST /api/sync/push", r.body.success ? "OK" : "");

  r = await request("POST", "/api/sync/conflicts", { medicoes: [] }, newToken);
  ok(r, "POST /api/sync/conflicts", r.body.success ? "OK" : "");

  r = await request("POST", "/api/sync/retry", {
    medicoes: [],
    diarios: [],
    solicitacoes: [],
    arquivos: [],
  }, newToken);
  ok(r, "POST /api/sync/retry", r.body.success ? "OK" : "");

  // ── Stats ─────────────────────────────────────────────────────────────────
  r = await request("GET", "/api/stats", null, newToken);
  ok(r, "GET  /api/stats", "obras: " + (r.body.data?.totalObras ?? "?"));

  // ── Management ────────────────────────────────────────────────────────────
  r = await request("GET", "/api/management/overview", null, newToken);
  ok(r, "GET  /api/management/overview", r.body.data ? "OK" : "");

  r = await request("GET", "/api/management/exports/obras.csv", null, newToken);
  console.log(r.status === 200 ? "✅" : "❌", "GET  /api/management/exports/obras.csv", "→ HTTP", r.status);

  r = await request("GET", "/api/management/exports/medicoes.csv", null, newToken);
  console.log(r.status === 200 ? "✅" : "❌", "GET  /api/management/exports/medicoes.csv", "→ HTTP", r.status);

  if (obraId) {
    r = await request("DELETE", "/api/obras/" + obraId, null, newToken);
    ok(r, "DELETE /api/obras/:id", r.body.success ? "soft delete OK" : "");
  }

  console.log("\n===== FIM DOS TESTES =====\n");
}

run().catch((e) => console.error("Erro fatal:", e.message));
