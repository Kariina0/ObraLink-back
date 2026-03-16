require("dotenv").config();
const http = require("http");

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    if (data) headers["Content-Length"] = Buffer.byteLength(data);

    const req = http.request(
      { hostname: "localhost", port: 5001, path, method, headers },
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

async function run() {
  console.log("\n===== TESTE DE ROTAS — Canteiro de Obra =====\n");

  // ── Auth ──────────────────────────────────────────────────────────────────
  let r = await request("POST", "/api/auth/login", { email: "admin@obralink.com", senha: "Admin@123" });
  if (!ok(r, "POST /api/auth/login", "usuario: " + (r.body.data?.user?.nome || ""))) return;
  const token = r.body.data.accessToken;
  const refreshToken = r.body.data.refreshToken;

  r = await request("GET", "/api/auth/me", null, token);
  ok(r, "GET  /api/auth/me", r.body.data?.email || "");

  r = await request("POST", "/api/auth/refresh", { refreshToken });
  ok(r, "POST /api/auth/refresh", r.body.data?.accessToken ? "novo token OK" : "");
  const newToken = r.body.data?.accessToken || token;

  // ── Obras ─────────────────────────────────────────────────────────────────
  r = await request("GET", "/api/obras", null, newToken);
  ok(r, "GET  /api/obras", "total: " + (r.body.data?.total ?? "?"));

  r = await request("POST", "/api/obras", {
    nome: "Obra Teste API",
    codigo: "OBT-" + Date.now(),
    status: "em_andamento",
    dataInicio: "2026-01-01",
  }, newToken);
  const obraId = r.body.data?.id;
  ok(r, "POST /api/obras", r.body.data?.nome || "");

  if (obraId) {
    r = await request("GET", "/api/obras/" + obraId, null, newToken);
    ok(r, "GET  /api/obras/:id", r.body.data?.nome || "");
  }

  // ── Medições ──────────────────────────────────────────────────────────────
  r = await request("POST", "/api/measurements", {
    obra: obraId || 1,
    data: new Date().toISOString(),
    itens: [{ descricao: "Laje", quantidade: 10, unidade: "m²", valorUnitario: 100 }],
    status: "enviada",
  }, newToken);
  const medicaoId = r.body.data?.id;
  ok(r, "POST /api/measurements", r.body.data?.id ? "id: " + r.body.data.id : "");

  r = await request("GET", "/api/measurements", null, newToken);
  ok(r, "GET  /api/measurements", "total: " + (r.body.data?.total ?? "?"));

  if (medicaoId) {
    r = await request("POST", "/api/measurements/" + medicaoId + "/aprovar", {}, newToken);
    ok(r, "POST /api/measurements/:id/aprovar", r.body.data?.status || "");
  }

  // ── Diários ───────────────────────────────────────────────────────────────
  r = await request("POST", "/api/diarios", {
    obra: obraId || 1,
    data: new Date().toISOString(),
    clima: "ensolarado",
    atividades: [{ descricao: "Concretagem da laje" }],
  }, newToken);
  const diarioId = r.body.data?.id;
  ok(r, "POST /api/diarios", r.body.data?.id ? "id: " + r.body.data.id : "");

  r = await request("GET", "/api/diarios", null, newToken);
  ok(r, "GET  /api/diarios", "total: " + (r.body.data?.total ?? "?"));

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

  // ── Stats ─────────────────────────────────────────────────────────────────
  r = await request("GET", "/api/stats", null, newToken);
  ok(r, "GET  /api/stats", "obras: " + (r.body.data?.totalObras ?? "?"));

  // ── Management ────────────────────────────────────────────────────────────
  r = await request("GET", "/api/management/overview", null, newToken);
  ok(r, "GET  /api/management/overview", r.body.data ? "OK" : "");

  console.log("\n===== FIM DOS TESTES =====\n");
}

run().catch((e) => console.error("Erro fatal:", e.message));
