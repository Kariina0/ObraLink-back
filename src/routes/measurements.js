const express = require("express");
const router = express.Router();
const medicaoController = require("../controllers/MedicaoController");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const {
  createMedicaoSchema,
  updateMedicaoSchema,
} = require("../validators/medicaoValidator");
const { PERFIS } = require("../constants");

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * @route GET /api/measurements
 * @desc Listar todas as medições (supervisor/admin)
 * @access Supervisor, Admin
 */
router.get("/", authorize(PERFIS.SUPERVISOR, PERFIS.ADMIN), medicaoController.getAll);

/**
 * @route POST /api/measurements
 * @desc Criar nova medição
 * @access Encarregado, Supervisor, Admin
 */
router.post("/", validate(createMedicaoSchema), medicaoController.create);

/**
 * @route GET /api/measurements/minhas
 * @desc Listar medições do usuário atual
 * @access Private
 */
router.get("/minhas", medicaoController.getMinhas);

/**
 * @route GET /api/measurements/obra/:obraId
 * @desc Listar medições de uma obra
 * @access Private
 */
router.get("/obra/:obraId", medicaoController.getByObra);

/**
 * @route GET /api/measurements/:id
 * @desc Obter medição por ID
 * @access Private
 */
router.get("/:id", medicaoController.getById);

/**
 * @route PUT /api/measurements/:id
 * @desc Atualizar medição
 * @access Private
 */
router.put("/:id", validate(updateMedicaoSchema), medicaoController.update);

/**
 * @route POST /api/measurements/:id/aprovar
 * @desc Aprovar medição
 * @access Supervisor, Admin
 */
router.post(
  "/:id/aprovar",
  authorize(PERFIS.SUPERVISOR, PERFIS.ADMIN),
  medicaoController.aprovar
);

/**
 * @route POST /api/measurements/:id/rejeitar
 * @desc Rejeitar medição
 * @access Supervisor, Admin
 */
router.post(
  "/:id/rejeitar",
  authorize(PERFIS.SUPERVISOR, PERFIS.ADMIN),
  medicaoController.rejeitar
);

/**
 * @route DELETE /api/measurements/:id
 * @desc Excluir medição (soft delete)
 * @access Private
 */
router.delete("/:id", medicaoController.delete);

module.exports = router;