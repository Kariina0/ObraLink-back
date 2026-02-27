require("dotenv").config();
const app = require("./app");
const database = require("./config/database");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;

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