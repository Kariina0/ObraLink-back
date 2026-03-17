require("dotenv").config();
const app = require("./app");
const supabase = require("./config/supabaseClient");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;
let server;

async function verifyDbConnection() {
  const { error } = await supabase.from("users").select("id").limit(1);
  if (error) throw new Error(`Falha ao conectar ao Supabase: ${error.message}`);
  logger.info("Conectado ao Supabase (PostgreSQL).");
}

async function start() {
  await verifyDbConnection();
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
  logger.info("Saindo.");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err) => {
  logger.error("Erro ao iniciar a aplicação:", err);
  process.exit(1);
});
