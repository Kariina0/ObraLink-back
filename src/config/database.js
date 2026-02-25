const logger = require("../utils/logger");
const knexfile = require("../../knexfile");
const Knex = require("knex");
const mongoose = require("mongoose");

class Database {
  constructor() {
    this.knex = null;
    this.mongoose = mongoose;
  }

  async connect() {
    const client = (process.env.DB_CLIENT || process.env.DATABASE_CLIENT || "mongodb").toLowerCase();
    if (client === "sqlite" || client === "sqlite3") {
      try {
        this.knex = Knex(knexfile.development);
        logger.info("✅ Conectado ao SQLite (Knex) com sucesso");
        return this.knex;
      } catch (err) {
        logger.error("❌ Erro ao conectar ao SQLite:", err);
        process.exit(1);
      }
    }

    // Default: connect mongoose (MongoDB)
    try {
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      };

      const uri = process.env.MONGODB_URI;
      if (!uri) {
        logger.error("❌ MONGODB_URI não definido no .env e DB_CLIENT não é sqlite");
        process.exit(1);
      }

      this.connection = await mongoose.connect(uri, options);
      logger.info("✅ Conectado ao MongoDB com sucesso");

      mongoose.connection.on("error", (err) => {
        logger.error("❌ Erro na conexão com MongoDB:", err);
      });

      mongoose.connection.on("disconnected", () => {
        logger.warn("⚠️ MongoDB desconectado. Tentando reconectar...");
      });

      mongoose.connection.on("reconnected", () => {
        logger.info("✅ MongoDB reconectado");
      });

      return this.connection;
    } catch (error) {
      logger.error("❌ Erro ao conectar ao MongoDB:", error);
      process.exit(1);
    }
  }

  async disconnect() {
    if (this.knex) {
      await this.knex.destroy();
      logger.info("📴 Desconectado do SQLite (Knex)");
      return;
    }

    try {
      await mongoose.connection.close();
      logger.info("📴 Desconectado do MongoDB");
    } catch (error) {
      logger.error("❌ Erro ao desconectar do MongoDB:", error);
      throw error;
    }
  }

  isConnected() {
    if (this.knex) return true;
    return mongoose.connection.readyState === 1;
  }
}

module.exports = new Database();
