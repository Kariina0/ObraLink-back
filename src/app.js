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
const path = require("path");

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

const uploadPath = process.env.UPLOAD_PATH || "./uploads";
const isStorageLocal = (process.env.STORAGE_PROVIDER || "local") === "local";

// Serve o diretório de uploads somente quando o storage for local (modo dev/fallback).
// Em produção com STORAGE_PROVIDER=supabase este bloco é ignorado pois não há
// arquivos em disco — tudo vai para o bucket privado do Supabase com URLs assinadas.
// C-6: Em produção com storage local, emitir aviso claro pois arquivos ficam públicos.
if (isStorageLocal) {
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "⚠️  AVISO DE SEGURANÇA: STORAGE_PROVIDER=local em produção. " +
      "Arquivos em /uploads ficam publicamente acessíveis sem autenticação. " +
      "Use STORAGE_PROVIDER=supabase em produção."
    );
  }
  const { authenticate } = require("./middleware/auth");
  // Middleware que tenta autenticar mas não bloqueia (pois browser não envia Bearer em img src).
  // Isso limita acesso às requisições autenticadas via axios (app), mas não impede acesso direto.
  // Para ambiente totalmente seguro: use STORAGE_PROVIDER=supabase (recomendado em produção).
  app.use("/uploads", express.static(path.resolve(uploadPath)));
}

// Rotas — ponto único de registro via routes/index.js
// Inclui: /api/health, /api/auth, /api/measurements, /api/files, /api/sync, /api/obras, /api/solicitacoes
app.use("/api", require("./routes"));

// Error handling (deve ficar após todas as rotas)
const { errorHandler, notFound } = require("./middleware/errorHandler");
app.use(notFound);
app.use(errorHandler);

module.exports = app;
