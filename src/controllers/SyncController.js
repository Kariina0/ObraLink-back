const syncService = require("../services/SyncService");
const { successResponse } = require("../utils/helpers");
const { asyncHandler } = require("../middleware/errorHandler");

class SyncController {
  /**
   * @route GET /api/sync/pending
   * @desc Obter dados pendentes de sincronização
   * @access Private
   */
  getPending = asyncHandler(async (req, res) => {
    const { lastSyncDate } = req.query;
    const data = await syncService.getPendingData(req.user.id, lastSyncDate);

    res.json(successResponse(data, "Dados pendentes de sincronização"));
  });

  /**
   * @route POST /api/sync/push
   * @desc Enviar dados em lote para sincronização
   * @access Private
   */
  pushBatch = asyncHandler(async (req, res) => {
    const results = await syncService.pushBatch(req.body, req.user.id);

    res.json(
      successResponse(
        results,
        `Sincronização concluída: ${results.success.length} sucesso(s), ${results.errors.length} erro(s), ${results.conflicts.length} conflito(s)`,
      ),
    );
  });

  /**
   * @route POST /api/sync/conflicts
   * @desc Obter conflitos de sincronização
   * @access Private
   */
  getConflicts = asyncHandler(async (req, res) => {
    const conflicts = await syncService.getConflicts(req.user.id, req.body);

    res.json(
      successResponse(
        conflicts,
        `${conflicts.length} conflito(s) detectado(s)`,
      ),
    );
  });

  /**
   * @route POST /api/sync/retry
   * @desc Retentar sincronização
   * @access Private
   */
  retrySynt = asyncHandler(async (req, res) => {
    const { syncFunction } = req.body;

    const result = await syncService.retrySync(() =>
      syncService.pushBatch(req.body, req.user.id),
    );

    res.json(successResponse(result, "Tentativa de sincronização realizada"));
  });
}

module.exports = new SyncController();
