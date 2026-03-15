require("dotenv").config();
const app = require("./app");
const database = require("./config/database");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;
let server;

async function start() {
  await database.connect();
  server = app.listen(PORT, () => {
    logger.info(`Servidor rodando na porta ${PORT}`);
  });
}

async function shutdown(signal) {
  logger.info(`${signal} recebido. Encerrando servidor...`);
  if (server) {
    server.close(() => {
      logger.info("Conexões HTTP encerradas.");
    });
  }
  await database.disconnect();
  logger.info("Banco de dados desconectado. Saindo.");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err) => {
  logger.error("Erro ao iniciar a aplicação:", err);
  process.exit(1);
});