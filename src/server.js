require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const database = require("./config/database");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
// Security and performance middlewares
app.use(helmet());
app.use(compression());
// Basic rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP
});
app.use(limiter);

// Parse JSON with size limit
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "10mb" }));

// Rotas
const medicoesRoutes = require("./routes/medicoes");
const solicitacoesRoutes = require("./routes/solicitacoes");
const authRoutes = require("./routes/auth");
const fileRoutes = require("./routes/files");
const purchaseRoutes = require("./routes/purchaseRoutes");
const syncRoutes = require("./routes/sync");
const obrasRoutes = require("./routes/obras");
const measurementsRoutes = require("./routes/measurements");

app.use("/api/medicoes", medicoesRoutes);
app.use("/api/solicitacoes", solicitacoesRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/obras", obrasRoutes);
app.use("/api/measurements", measurementsRoutes);

async function start() {
    await database.connect();
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

start().catch((err) => {
    logger.error("Erro ao iniciar a aplicação:", err);
    process.exit(1);
});