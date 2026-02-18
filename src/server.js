require("dotenv").config();
const app = require("./app");
const database = require("./config/database");
const logger = require("./utils/logger");

// Importa rotas de compras
const purchaseRoutes = require("./routes/purchaseRoutes");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Conectar ao banco de dados
    await database.connect();

    // Registrar rotas
    app.use("/api/purchases", purchaseRoutes);

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Servidor rodando na porta ${PORT}`);
      logger.info(`📝 Ambiente: ${process.env.NODE_ENV || "development"}`);
      logger.info(`🌐 URL: http://localhost:${PORT}`);
    });

    // Encerramento gracioso
    const gracefulShutdown = async (signal) => {
      logger.info(`\n${signal} recebido. Encerrando servidor...`);

      server.close(async () => {
        logger.info("🔴 Servidor HTTP encerrado");

        try {
          await database.disconnect();
          logger.info("✅ Encerramento gracioso concluído");
          process.exit(0);
        } catch (error) {
          logger.error("❌ Erro ao encerrar:", error);
          process.exit(1);
        }
      });

      // Forçar encerramento após 10 segundos
      setTimeout(() => {
        logger.error("⚠️ Encerramento forçado");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    process.on("unhandledRejection", (reason) => {
      logger.error("❌ Unhandled Rejection:", reason);
    });

    process.on("uncaughtException", (error) => {
      logger.error("❌ Uncaught Exception:", error);
      process.exit(1);
    });
  } catch (error) {
    logger.error("❌ Erro ao iniciar servidor:", error);
    process.exit(1);
  }
}

startServer();
