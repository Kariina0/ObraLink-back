const express = require("express");
const router = express.Router();
const syncController = require("../controllers/SyncController");
const { authenticate } = require("../middleware/auth");
const { validate, validateQuery } = require("../middleware/validation");
const {
	pendingQuerySchema,
	pushBatchSchema,
	conflictsSchema,
} = require("../validators/syncValidator");

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * @route GET /api/sync/pending
 * @desc Obter dados pendentes de sincronização
 * @access Private
 */
router.get("/pending", validateQuery(pendingQuerySchema), syncController.getPending);

/**
 * @route POST /api/sync/push
 * @desc Enviar dados em lote para sincronização
 * @access Private
 */
router.post("/push", validate(pushBatchSchema), syncController.pushBatch);

/**
 * @route POST /api/sync/conflicts
 * @desc Obter conflitos de sincronização
 * @access Private
 */
router.post("/conflicts", validate(conflictsSchema), syncController.getConflicts);

/**
 * @route POST /api/sync/retry
 * @desc Retentar sincronização
 * @access Private
 */
router.post("/retry", validate(pushBatchSchema), syncController.retrySynt);

module.exports = router;
