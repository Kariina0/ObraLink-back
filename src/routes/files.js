const express = require("express");
const router = express.Router();
const arquivoController = require("../controllers/ArquivoController");
const { authenticate, authorize } = require("../middleware/auth");
const { upload, cleanupOnError } = require("../config/multer");
const { validate } = require("../middleware/validation");
const { uploadArquivoSchema } = require("../validators/arquivoValidator");
const { PERFIS } = require("../constants");

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * @route POST /api/files/upload
 * @desc Upload de arquivo único (campos obrigatórios: obra, tipoArquivo, descricao)
 * @access Private
 */
router.post(
  "/upload",
  upload.single("file"),
  cleanupOnError,
  validate(uploadArquivoSchema),
  arquivoController.upload,
);

/**
 * @route POST /api/files/upload-multiple
 * @desc Upload de múltiplos arquivos (campos obrigatórios: obra, tipoArquivo, descricao)
 * @access Private
 */
router.post(
  "/upload-multiple",
  upload.array("files", 10),
  cleanupOnError,
  validate(uploadArquivoSchema),
  arquivoController.uploadMultiple,
);

/**
 * @route GET /api/files/storage/usage
 * @desc Obter uso de armazenamento
 * @access Admin
 */
router.get(
  "/storage/usage",
  authorize(PERFIS.ADMIN),
  arquivoController.getStorageUsage,
);

/**
 * @route GET /api/files/obra/:obraId
 * @desc Listar arquivos de uma obra
 * @access Private
 */
router.get("/obra/:obraId", arquivoController.getByObra);

/**
 * @route GET /api/files/tipo/:tipo
 * @desc Listar arquivos por tipo
 * @access Private
 */
router.get("/tipo/:tipo", arquivoController.getByTipo);

/**
 * @route GET /api/files/:id
 * @desc Obter arquivo por ID
 * @access Private
 */
router.get("/:id", arquivoController.getById);

/**
 * @route DELETE /api/files/:id
 * @desc Excluir arquivo
 * @access Private
 */
router.delete("/:id", arquivoController.delete);

module.exports = router;


/**
 * @route GET /api/files/storage/usage
 * @desc Obter uso de armazenamento
 * @access Admin
 */
router.get(
  "/storage/usage",
  authorize(PERFIS.ADMIN),
  arquivoController.getStorageUsage,
);

/**
 * @route GET /api/files/obra/:obraId
 * @desc Listar arquivos de uma obra
 * @access Private
 */
router.get("/obra/:obraId", arquivoController.getByObra);

/**
 * @route GET /api/files/tipo/:tipo
 * @desc Listar arquivos por tipo
 * @access Private
 */
router.get("/tipo/:tipo", arquivoController.getByTipo);

/**
 * @route GET /api/files/:id
 * @desc Obter arquivo por ID
 * @access Private
 */
router.get("/:id", arquivoController.getById);

/**
 * @route DELETE /api/files/:id
 * @desc Excluir arquivo
 * @access Private
 */
router.delete("/:id", arquivoController.delete);

module.exports = router;
