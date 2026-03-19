const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const logger = require("../utils/logger");
const { TIPOS_ARQUIVO } = require("../constants");

const isSupabase = (process.env.STORAGE_PROVIDER || "local") === "supabase";

// --- Storage local (fallback) ---
const uploadDir = process.env.UPLOAD_PATH || "./uploads";
if (!isSupabase && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Compatibilidade: frontend envia `tipoArquivo`; alguns clientes legados enviam `tipo`.
    const requested = String(req.body.tipoArquivo || req.body.tipo || "").trim();
    const allowed = Object.values(TIPOS_ARQUIVO || {});
    const subfolder = allowed.includes(requested) ? requested : "outros";
    const dest = path.join(uploadDir, subfolder);
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// --- Filtro de tipos (compartilhado entre os dois modos) ---
const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(",") || [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
    "application/pdf",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
  }
};

// --- Instância do multer ---
// Quando STORAGE_PROVIDER=supabase: memoryStorage (buffer em RAM, sem disco)
// Quando STORAGE_PROVIDER=local   : diskStorage  (salva em ./uploads/)
const upload = multer({
  storage: isSupabase ? multer.memoryStorage() : diskStorage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5 MB
  },
});

// --- Limpeza de uploads falhos (apenas modo local) ---
const cleanupOnError = (req, res, next) => {
  if (!isSupabase) {
    res.on("finish", () => {
      if (res.statusCode >= 400 && (req.file || req.files)) {
        const files = req.file
          ? [req.file]
          : Array.isArray(req.files)
            ? req.files
            : Object.values(req.files).flat();
        files.forEach((file) => {
          if (file.path) {
            fs.unlink(file.path, (err) => {
              if (err) logger.error("Erro ao remover arquivo:", err);
            });
          }
        });
      }
    });
  }
  next();
};

module.exports = {
  upload,
  cleanupOnError,
  uploadDir,
  isSupabase,
};
