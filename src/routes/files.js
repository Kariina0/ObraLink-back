const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const arquivoController = require("../controllers/ArquivoController");
const { authenticate, authorize, optionalAuth } = require("../middleware/auth");
const { upload, cleanupOnError } = require("../config/multer");
const { validate } = require("../middleware/validation");
const { uploadArquivoSchema } = require("../validators/arquivoValidator");
const { PERFIS } = require("../constants");

const rawFileAccessMiddleware =
  process.env.NODE_ENV === "production" ? authenticate : optionalAuth;

/**
 * @route GET /api/files/raw/:tipo/:filename
 * @desc Servir arquivo local em disco com autenticação obrigatória (CC-02).
 *       Substitui o express.static público de /uploads.
 *       Apenas STORAGE_PROVIDER=local utiliza esta rota; no modo Supabase
 *       os arquivos são acessados via URLs assinadas diretamente.
 * @access Private
 */
router.get("/raw/:tipo/:filename", rawFileAccessMiddleware, async (req, res, next) => {
  try {
    const { tipo, filename } = req.params;

    // Proteção contra path traversal: permite apenas caracteres seguros em cada segmento.
    // Rejeita "../", "%2F", null bytes e qualquer variante de escape.
    const SAFE_SEGMENT = /^[\w.-]+$/;
    if (!SAFE_SEGMENT.test(tipo) || !SAFE_SEGMENT.test(filename)) {
      return res.status(400).json({ error: "Caminho de arquivo inválido" });
    }

    const uploadRoot = path.resolve(process.env.UPLOAD_PATH || "./uploads");
    const filePath = path.resolve(uploadRoot, tipo, filename);
    const fallbackPath = path.resolve(uploadRoot, "outros", filename);

    // Dupla verificação: o path resolvido deve permanecer dentro de uploadRoot.
    if (!filePath.startsWith(uploadRoot + path.sep)) {
      return res.status(400).json({ error: "Caminho de arquivo inválido" });
    }

    let readablePath = filePath;
    try {
      await fs.promises.access(readablePath);
    } catch (err) {
      // Compatibilidade com uploads legados que foram gravados em /outros
      if (err.code === "ENOENT") {
        await fs.promises.access(fallbackPath);
        readablePath = fallbackPath;
      } else {
        throw err;
      }
    }

    const MIME = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".heic": "image/heic",
      ".heif": "image/heif",
      ".pdf": "application/pdf",
    };
    const ext = path.extname(readablePath).toLowerCase();
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=3600");
    fs.createReadStream(readablePath).pipe(res);
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ error: "Arquivo não encontrado" });
    }
    next(err);
  }
});

// Todas as demais rotas requerem autenticação
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
