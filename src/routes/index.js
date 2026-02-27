const express = require("express");
const router = express.Router();

// Importar rotas
const authRoutes = require("./auth");
const measurementRoutes = require("./measurements");
const fileRoutes = require("./files");
const syncRoutes = require("./sync");
const obrasRoutes = require("./obras");
const solicitacoesRoutes = require("./solicitacoes");

// Rota de health check
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Registrar rotas
router.use("/auth",         authRoutes);
router.use("/measurements", measurementRoutes);
router.use("/files",        fileRoutes);
router.use("/sync",         syncRoutes);
router.use("/obras",        obrasRoutes);
router.use("/solicitacoes", solicitacoesRoutes);

module.exports = router;
