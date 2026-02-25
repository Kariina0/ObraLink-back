const express = require("express");
const router = express.Router();

// Importar rotas
const authRoutes = require("./auth");
const measurementRoutes = require("./measurements");
const fileRoutes = require("./files");
const syncRoutes = require("./sync"); 
const purchaseRoutes = require("./purchaseRoutes");
const obrasRoutes = require("./obras");

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
router.use("/auth", authRoutes);
router.use("/measurements", measurementRoutes);
router.use("/files", fileRoutes);
router.use("/sync", syncRoutes);
router.use("/purchases", purchaseRoutes);
router.use("/obras", obrasRoutes);

module.exports = router;
