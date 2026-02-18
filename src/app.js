const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const routes = require("./routes");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const logger = require("./utils/logger");

const app = express();

// ----------------------
// Configuração de segurança
// ----------------------
app.use(helmet());

// ----------------------
// Configuração de CORS
// ----------------------
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// ----------------------
// Compressão de respostas
// ----------------------
app.use(compression());

// ----------------------
// Body parser
// ----------------------
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ----------------------
// Rate limiting (apenas para autenticação)
// ----------------------
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: "Muitas requisições deste IP, tente novamente mais tarde",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth", limiter);

// ----------------------
// Servir arquivos estáticos (uploads)
// ----------------------
app.use("/uploads", express.static("uploads"));

// ----------------------
// Log de requisições em desenvolvimento
// ----------------------
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
  });
}

// ----------------------
// Rotas da API
// ----------------------
app.use("/api", routes);

// ----------------------
// Rota raiz
// ----------------------
app.get("/", (req, res) => {
  res.json({
    message: "API Sistema de Construção Civil 🚀",
    version: "1.0.0",
    documentation: "/api/health",
  });
});

// ----------------------
// Middleware de rota não encontrada
// ----------------------
app.use(notFound);

// ----------------------
// Middleware de tratamento de erros
// ----------------------
app.use(errorHandler);

module.exports = app;
