const express = require("express");
const router = express.Router();
const medicaoController = require("../controllers/MedicaoController");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const {
  createMedicaoSchema,
  updateMedicaoSchema,
} = require("../validators/medicaoValidator");
const { ValidationError } = require("../utils/errors");
const { PERFIS } = require("../constants");

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * Middleware para validar :id como inteiro positivo, evitando consultas
 * desnecessárias ao banco com valores inválidos (ex: 'abc', '-1').
 */
const validateIntId = (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new ValidationError("ID inválido"));
  }
  req.params.id = id;
  next();
};

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
 * @route GET /api/measurements/rascunhos
 * @desc Listar RASCUNHOS do usuário atual
 * @access Private
 */
router.get("/rascunhos", medicaoController.getRascunhos);

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
router.get("/:id", validateIntId, medicaoController.getById);

/**
 * @route PUT /api/measurements/:id
 * @desc Atualizar medição
 * @access Private
 */
router.put("/:id", validateIntId, validate(updateMedicaoSchema), medicaoController.update);

/**
 * @route POST /api/measurements/:id/aprovar
 * @desc Aprovar medição
 * @access Supervisor, Admin
 */
router.post(
  "/:id/aprovar",
  validateIntId,
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
  validateIntId,
  authorize(PERFIS.SUPERVISOR, PERFIS.ADMIN),
  medicaoController.rejeitar
);

/**
 * @route DELETE /api/measurements/:id
 * @desc Excluir medição (soft delete)
 * @access Dono da medição ou Admin
 */
router.delete(
  "/:id",
  validateIntId,
  authorize(PERFIS.ENCARREGADO, PERFIS.ADMIN),
  medicaoController.delete,
);

module.exports = router;