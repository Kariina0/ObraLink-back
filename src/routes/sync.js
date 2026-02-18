const express = require("express");
const router = express.Router();
const syncController = require("../controllers/SyncController");
const { authenticate } = require("../middleware/auth");

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * @route GET /api/sync/pending
 * @desc Obter dados pendentes de sincronização
 * @access Private
 */
router.get("/pending", syncController.getPending);

/**
 * @route POST /api/sync/push
 * @desc Enviar dados em lote para sincronização
 * @access Private
 */
router.post("/push", syncController.pushBatch);

/**
 * @route POST /api/sync/conflicts
 * @desc Obter conflitos de sincronização
 * @access Private
 */
router.post("/conflicts", syncController.getConflicts);

/**
 * @route POST /api/sync/retry
 * @desc Retentar sincronização
 * @access Private
 */
router.post("/retry", syncController.retrySynt);

module.exports = router;
