const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse } = require("../utils/helpers");
const { PERFIS } = require("../constants");
const supabase = require("../config/supabaseClient");

function isMissingDeletedAtColumn(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("deletedat") && message.includes("does not exist");
}

async function runWithDeletedAtFallback(buildQuery) {
  const firstTry = await buildQuery(true);
  if (!firstTry.error || !isMissingDeletedAtColumn(firstTry.error)) {
    return firstTry;
  }
  return buildQuery(false);
}

// Importar rotas
const authRoutes = require("./auth");
const measurementRoutes = require("./measurements");
const fileRoutes = require("./files");
const syncRoutes = require("./sync");
const obrasRoutes = require("./obras");
const solicitacoesRoutes = require("./solicitacoes");
const diariosRoutes = require("./diarios");
const managementRoutes = require("./management");

// Rota de health check — verifica conectividade com o banco via Supabase
router.get("/health", asyncHandler(async (req, res) => {
  try {
    const { error } = await supabase.from("users").select("id").limit(1);
    if (error) throw error;
    res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "error", db: "disconnected", timestamp: new Date().toISOString() });
  }
}));

/**
 * @route GET /api/stats
 * @desc Estatísticas reais do sistema via Supabase (COUNT sem carregar registros)
 * @access Admin, Supervisor
 */
router.get(
  "/stats",
  authenticate,
  authorize(PERFIS.ADMIN, PERFIS.SUPERVISOR),
  asyncHandler(async (req, res) => {
    // Usa a view v_stats criada em scripts/supabase_rls_auth.sql
    // para evitar múltiplas roundtrips ao BD
    const { data, error } = await supabase
      .from("v_stats")
      .select("*")
      .single();

    if (error) {
      // Fallback: queries individuais caso a view não exista ainda
      const countWithSoftDeleteFallback = async (table, status = null) => {
        const result = await runWithDeletedAtFallback((withDeletedAt) => {
          let query = supabase
            .from(table)
            .select("*", { count: "exact", head: true });

          if (withDeletedAt) {
            query = query.is("deletedAt", null);
          }

          if (status) {
            query = query.eq("status", status);
          }

          return query;
        });

        return result.count ?? 0;
      };

      const counts = await Promise.all([
        countWithSoftDeleteFallback("obras"),
        countWithSoftDeleteFallback("medicoes"),
        countWithSoftDeleteFallback("medicoes", "enviada"),
        countWithSoftDeleteFallback("medicoes", "aprovada"),
        countWithSoftDeleteFallback("solicitacoes_compra"),
        countWithSoftDeleteFallback("solicitacoes_compra", "pendente"),
        countWithSoftDeleteFallback("arquivos"),
      ]);

      return res.json(
        successResponse(
          {
            totalObras:              counts[0] ?? 0,
            totalMedicoes:           counts[1] ?? 0,
            medicoesPendentes:       counts[2] ?? 0,
            medicoesAprovadas:       counts[3] ?? 0,
            totalSolicitacoes:       counts[4] ?? 0,
            solicitacoesPendentes:   counts[5] ?? 0,
            totalArquivos:           counts[6] ?? 0,
          },
          "Estatísticas carregadas",
        ),
      );
    }

    res.json(
      successResponse(
        {
          totalObras:            Number(data.total_obras          ?? 0),
          totalMedicoes:         Number(data.total_medicoes        ?? 0),
          medicoesPendentes:     Number(data.medicoes_pendentes    ?? 0),
          medicoesAprovadas:     Number(data.medicoes_aprovadas    ?? 0),
          totalSolicitacoes:     Number(data.total_solicitacoes    ?? 0),
          solicitacoesPendentes: Number(data.solicitacoes_pendentes ?? 0),
          totalArquivos:         Number(data.total_arquivos        ?? 0),
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
