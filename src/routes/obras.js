const express = require("express");
const router = express.Router();
const obraController = require("../controllers/ObraController");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const {
  createObraSchema,
  updateObraSchema,
  vincularEncarregadoSchema,
  updateStatusSchema,
} = require("../validators/obraValidator");
const { PERFIS } = require("../constants");

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * @route GET /api/obras
 * @desc Listar obras (encarregado vê apenas as suas)
 * @access Private
 */
router.get("/", obraController.list);

/**
 * @route GET /api/obras/:id
 * @desc Obter obra por ID
 * @access Private
 */
router.get("/:id", obraController.getById);

/**
 * @route POST /api/obras
 * @desc Criar nova obra
 * @access Admin
 */
router.post(
  "/",
  authorize(PERFIS.ADMIN),
  validate(createObraSchema),
  obraController.create,
);

/**
 * @route PUT /api/obras/:id
 * @desc Atualizar obra
 * @access Admin
 */
router.put(
  "/:id",
  authorize(PERFIS.ADMIN),
  validate(updateObraSchema),
  obraController.update,
);

/**
 * @route DELETE /api/obras/:id
 * @desc Remover obra (soft delete)
 * @access Admin
 */
router.delete("/:id", authorize(PERFIS.ADMIN), obraController.delete);

/**
 * @route GET /api/obras/:id/encarregados/disponiveis
 * @desc Listar usuários disponíveis para vincular como encarregados (ainda não vinculados)
 * @access Admin
 */
router.get(
  "/:id/encarregados/disponiveis",
  authorize(PERFIS.ADMIN),
  obraController.listarEncarregadosDisponiveis,
);

/**
 * @route POST /api/obras/:id/encarregados
 * @desc Vincular encarregado a uma obra
 * @access Admin
 */
router.post(
  "/:id/encarregados",
  authorize(PERFIS.ADMIN),
  validate(vincularEncarregadoSchema),
  obraController.vincularEncarregado,
);

/**
 * @route DELETE /api/obras/:id/encarregados/:userId
 * @desc Desvincular encarregado de uma obra
 * @access Admin
 */
router.delete(
  "/:id/encarregados/:userId",
  authorize(PERFIS.ADMIN),
  obraController.desvincularEncarregado,
);

router.patch(
  "/:id/status",
  authorize(PERFIS.ADMIN),
  validate(updateStatusSchema),
  obraController.updateStatus,
);

module.exports = router;

