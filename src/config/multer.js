const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const logger = require("../utils/logger");
const { TIPOS_ARQUIVO } = require("../constants");

// Criar diretório de uploads se não existir
const uploadDir = process.env.UPLOAD_PATH || "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração de armazenamento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // sanitize and whitelist subfolder type
    const requested = String(req.body.tipo || "").trim();
    const allowed = Object.values(TIPOS_ARQUIVO || {});
    const subfolder = allowed.includes(requested) ? requested : "outros";
    const dest = path.join(uploadDir, subfolder);

    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Filtro de tipos de arquivo
const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(",") || [
    "image/jpeg",
    "image/png",
    "application/pdf",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
  }
};

// Configuração do multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB padrão
  },
});

// Middleware para limpeza de uploads falhos
const cleanupOnError = (req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode >= 400 && req.files) {
      const files = Array.isArray(req.files)
        ? req.files
        : Object.values(req.files).flat();

      files.forEach((file) => {
        fs.unlink(file.path, (err) => {
          if (err) logger.error("Erro ao remover arquivo:", err);
        });
      });
    }
  });
  next();
};

module.exports = {
  upload,
  cleanupOnError,
  uploadDir,
};
