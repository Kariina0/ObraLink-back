const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse } = require("../utils/helpers");
const { PERFIS } = require("../constants");
// db carregado lazily dentro do handler para garantir que a conexão já foi estabelecida
const getKnex = () => require("../config/database").knex;

// Importar rotas
const authRoutes = require("./auth");
const measurementRoutes = require("./measurements");
const fileRoutes = require("./files");
const syncRoutes = require("./sync");
const obrasRoutes = require("./obras");
const solicitacoesRoutes = require("./solicitacoes");
const diariosRoutes = require("./diarios");
const managementRoutes = require("./management");

// Rota de health check — verifica conectividade com o banco (I-3)
router.get("/health", asyncHandler(async (req, res) => {
  try {
    await getKnex().raw("SELECT 1");
    res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "error", db: "disconnected", timestamp: new Date().toISOString() });
  }
}));

/**
 * @route GET /api/stats
 * @desc Estatísticas reais do sistema via COUNT SQL (sem carregar todos os registros)
 * @access Admin, Supervisor
 */
router.get(
  "/stats",
  authenticate,
  authorize(PERFIS.ADMIN, PERFIS.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const knex = getKnex();

    const [
      totalObras,
      totalMedicoes,
      medicoesPendentes,
      medicoesAprovadas,
      totalSolicitacoes,
      solicitacoesPendentes,
      totalArquivos,
    ] = await Promise.all([
      knex("obras").count("id as c").first(),
      knex("medicoes").count("id as c").first(),
      knex("medicoes").where("status", "enviada").count("id as c").first(),
      knex("medicoes").where("status", "aprovada").count("id as c").first(),
      knex("solicitacoes_compra").count("id as c").first(),
      knex("solicitacoes_compra").where("status", "pendente").count("id as c").first(),
      knex("arquivos").count("id as c").first(),
    ]);

    const toNum = (r) => Number(r?.c || r?.["count(`id`)"] || r?.["count(id)"] || 0);

    res.json(
      successResponse(
        {
          totalObras: toNum(totalObras),
          totalMedicoes: toNum(totalMedicoes),
          medicoesPendentes: toNum(medicoesPendentes),
          medicoesAprovadas: toNum(medicoesAprovadas),
          totalSolicitacoes: toNum(totalSolicitacoes),
          solicitacoesPendentes: toNum(solicitacoesPendentes),
          totalArquivos: toNum(totalArquivos),
        },
        "Estatísticas carregadas",
      ),
    );
  }),
);

// Registrar rotas
router.use("/auth",         authRoutes);
router.use("/measurements", measurementRoutes);
router.use("/files",        fileRoutes);
router.use("/sync",         syncRoutes);
router.use("/obras",        obrasRoutes);
router.use("/solicitacoes", solicitacoesRoutes);
router.use("/diarios",      diariosRoutes);
router.use("/management",   managementRoutes);

module.exports = router;
