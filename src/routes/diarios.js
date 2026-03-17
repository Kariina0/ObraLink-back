const express = require("express");
const router = express.Router();
const diarioController = require("../controllers/DiarioController");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const {
  createDiarioSchema,
  updateDiarioSchema,
} = require("../validators/diarioValidator");
const { PERFIS } = require("../constants");

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * @route GET /api/diarios
 * @desc Listar todos os diários (supervisor/admin)
 * @access Supervisor, Admin
 */
router.get(
  "/",
  authorize(PERFIS.SUPERVISOR, PERFIS.ADMIN),
  diarioController.getAll,
);

/**
 * @route POST /api/diarios
 * @desc Criar novo registro de Diário de Obra
 * @access Encarregado, Supervisor, Admin
 */
router.post("/", validate(createDiarioSchema), diarioController.create);

/**
 * @route GET /api/diarios/check
 * @desc Verifica duplicidade: existe diário para obra+data?
 * @access Private
 * @query obra, data
 */
router.get("/check", diarioController.check);

/**
 * @route GET /api/diarios/minhas
 * @desc Listar diários do usuário logado com paginação
 * @access Private
 */
router.get("/minhas", diarioController.getMinhas);

/**
 * @route GET /api/diarios/:id
 * @desc Obter diário por ID
 * @access Private
 */
router.get("/:id", diarioController.getById);

/**
 * @route PUT /api/diarios/:id
 * @desc Atualizar diário
 * @access Private
 */
router.put("/:id", validate(updateDiarioSchema), diarioController.update);

/**
 * @route DELETE /api/diarios/:id
 * @desc Remover diário (soft delete)
 * @access Private
 */
router.delete("/:id", diarioController.delete);

module.exports = router;
