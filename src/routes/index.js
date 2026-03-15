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

// Rota de health check — informações mínimas para não expor dados de infraestrutura (I-6)
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

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
