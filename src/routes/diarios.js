const express = require("express");
const router = express.Router();
const diarioController = require("../controllers/DiarioController");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const { createDiarioSchema, updateDiarioSchema } = require("../validators/diarioValidator");
const { PERFIS } = require("../constants");

router.use(authenticate);

router.get("/", authorize(PERFIS.SUPERVISOR, PERFIS.ADMIN), diarioController.getAll);
router.post("/", validate(createDiarioSchema), diarioController.create);
router.get("/minhas", diarioController.getMinhas);
router.get("/obra/:obraId", diarioController.getByObra);
router.get("/:id", diarioController.getById);
router.put("/:id", validate(updateDiarioSchema), diarioController.update);
router.delete("/:id", diarioController.delete);

module.exports = router;
