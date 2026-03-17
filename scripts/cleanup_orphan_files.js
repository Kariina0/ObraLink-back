/**
 * cleanup_orphan_files.js — Job de limpeza de arquivos órfãos no Supabase Storage.
 *
 * Um arquivo é considerado órfão quando existe no bucket do Supabase mas não
 * possui registro correspondente na tabela "arquivos" do banco de dados.
 *
 * Uso:
 *   node scripts/cleanup_orphan_files.js              # modo dry-run (só lista)
 *   node scripts/cleanup_orphan_files.js --execute    # remove de fato
 *   node scripts/cleanup_orphan_files.js --execute --prefix foto_obra/  # filtra prefixo
 *
 * Variáveis de ambiente necessárias (.env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_STORAGE_BUCKET   (padrão: obras-arquivos)
 */

require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

// ── Configuração ──────────────────────────────────────────────────────────────
const SUPABASE_URL    = process.env.SUPABASE_URL;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET          = process.env.SUPABASE_STORAGE_BUCKET || "obras-arquivos";
const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || "local").toLowerCase();

const args        = process.argv.slice(2);
const DRY_RUN     = !args.includes("--execute");
const prefixArg   = args.find((a) => a.startsWith("--prefix="));
const FOLDER_PREFIX = prefixArg ? prefixArg.split("=")[1] : "";

// ─────────────────────────────────────────────────────────────────────────────

function fatal(msg) {
  console.error(`\n[ERRO] ${msg}\n`);
  process.exit(1);
}

function log(msg)  { console.log(`[INFO]  ${msg}`); }
function warn(msg) { console.warn(`[WARN]  ${msg}`); }

// ── Validações de pré-requisitos ──────────────────────────────────────────────
if (STORAGE_PROVIDER !== "supabase") {
  fatal(
    `STORAGE_PROVIDER é "${STORAGE_PROVIDER}". ` +
    "Este script só faz sentido quando STORAGE_PROVIDER=supabase."
  );
}

if (!SUPABASE_URL)   fatal("SUPABASE_URL não definida.");
if (!SERVICE_KEY)    fatal("SUPABASE_SERVICE_ROLE_KEY não definida.");

// ── Cliente Supabase ──────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Lista TODOS os arquivos em um bucket (paginado de 100 em 100).
 * @param {string} folder - Prefixo de pasta (ex: "foto_obra/")
 * @returns {Promise<Array<{name: string, id: string}>>}
 */
async function listAllStorageFiles(folder = "") {
  const pageSize = 100;
  let offset = 0;
  const all = [];

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(folder, { limit: pageSize, offset });

    if (error) throw new Error(`Erro ao listar storage: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

/**
 * Busca todos os storage_path registados no banco (coluna arquivos.storage_path).
 * Retorna um Set para lookup O(1).
 * @returns {Promise<Set<string>>}
 */
async function getKnownStoragePaths() {
  const pageSize = 1000;
  let offset = 0;
  const known = new Set();

  while (true) {
    const { data, error } = await supabase
      .from("arquivos")
      .select("storage_path")
      .not("storage_path", "is", null)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Erro ao consultar banco: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.storage_path) known.add(row.storage_path);
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return known;
}

// ── Lógica principal ──────────────────────────────────────────────────────────

async function run() {
  log(`Bucket: ${BUCKET}`);
  log(`Prefixo de pasta: ${FOLDER_PREFIX || "(raiz)"}`);
  log(`Modo: ${DRY_RUN ? "DRY-RUN (use --execute para remover)": "EXECUÇÃO REAL"}`);
  log("─────────────────────────────────────────────────────");

  // 1. Listar arquivos no storage
  log("Listando arquivos no Supabase Storage...");
  const storageFiles = await listAllStorageFiles(FOLDER_PREFIX);
  log(`Total de arquivos no storage: ${storageFiles.length}`);

  if (storageFiles.length === 0) {
    log("Nenhum arquivo no storage para verificar.");
    return;
  }

  // 2. Buscar paths conhecidos no banco
  log("Buscando paths registrados no banco de dados...");
  const knownPaths = await getKnownStoragePaths();
  log(`Total de paths no banco: ${knownPaths.size}`);

  // 3. Identificar órfãos
  const prefix = FOLDER_PREFIX ? (FOLDER_PREFIX.endsWith("/") ? FOLDER_PREFIX : FOLDER_PREFIX + "/") : "";
  const orphans = storageFiles
    .filter((f) => !knownPaths.has(prefix + f.name))
    .map((f) => prefix + f.name);

  log(`─────────────────────────────────────────────────────`);
  log(`Arquivos órfãos encontrados: ${orphans.length}`);

  if (orphans.length === 0) {
    log("✅ Nenhum arquivo órfão. Storage está limpo.");
    return;
  }

  // 4. Exibir lista
  for (const path of orphans) {
    warn(`Órfão: ${path}`);
  }

  // 5. Remover se --execute
  if (DRY_RUN) {
    log(`\n[DRY-RUN] Nenhum arquivo foi removido. Execute com --execute para remover.`);
    return;
  }

  log("\nRemovendo arquivos órfãos...");
  const BATCH_SIZE = 20;
  let removed = 0;
  let failed  = 0;

  for (let i = 0; i < orphans.length; i += BATCH_SIZE) {
    const batch = orphans.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);

    if (error) {
      warn(`Falha ao remover lote [${i}–${i + batch.length}]: ${error.message}`);
      failed += batch.length;
    } else {
      removed += batch.length;
      log(`Removidos: ${removed}/${orphans.length}`);
    }
  }

  log(`─────────────────────────────────────────────────────`);
  log(`✅ Limpeza concluída — removidos: ${removed} | falhas: ${failed}`);
}

run().catch((err) => {
  console.error("[ERRO FATAL]", err.message);
  process.exit(1);
});
