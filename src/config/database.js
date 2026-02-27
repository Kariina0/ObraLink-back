const logger = require("../utils/logger");
const knexfile = require("../../knexfile");
const Knex = require("knex");

class Database {
  constructor() {
    this.knex = null;
  }

  async connect() {
    try {
      const env = process.env.NODE_ENV || "development";
      this.knex = Knex(knexfile[env] || knexfile.development);
      // Testar conexão
      await this.knex.raw("SELECT 1");
      logger.info("✅ Conectado ao SQLite (Knex) com sucesso");
      return this.knex;
    } catch (err) {
      logger.error("❌ Erro ao conectar ao SQLite:", err);
      process.exit(1);
    }
  }

  async disconnect() {
    if (this.knex) {
      await this.knex.destroy();
      logger.info("📴 Desconectado do SQLite (Knex)");
    }
  }

  isConnected() {
    return this.knex !== null;
  }
}

module.exports = new Database();
