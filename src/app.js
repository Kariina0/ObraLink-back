/**
 * app.js — configura e exporta o Express sem iniciar o servidor.
 * Importado por server.js (produção) e pelos testes de integração.
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const app = express();

// Confia no IP do primeiro proxy reverso (Nginx, load balancer).
// Necessário para que express-rate-limit leia X-Forwarded-For em vez do IP do proxy. (I-10)
app.set("trust proxy", 1);

// ── CORS ─────────────────────────────────────────────────────────────────────
// Configura origens permitidas via variável de ambiente para evitar exposição
// total em produção. Em desenvolvimento aceita localhost por padrão.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "http://localhost:8080"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (ex: mobile, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(helmet());
app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
});
app.use(limiter);

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "10mb" }));

// Rotas — ponto único de registro via routes/index.js
// Inclui: /api/health, /api/auth, /api/measurements, /api/files, /api/sync, /api/obras, /api/solicitacoes
app.use("/api", require("./routes"));

// Error handling (deve ficar após todas as rotas)
const { errorHandler, notFound } = require("./middleware/errorHandler");
app.use(notFound);
app.use(errorHandler);

module.exports = app;
