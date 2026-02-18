const mongoose = require("mongoose");
const logger = require("../utils/logger");

class Database {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      };

      this.connection = await mongoose.connect(
        process.env.MONGODB_URI,
        options,
      );

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
    try {
      await mongoose.connection.close();
      logger.info("📴 Desconectado do MongoDB");
    } catch (error) {
      logger.error("❌ Erro ao desconectar do MongoDB:", error);
      throw error;
    }
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }
}

module.exports = new Database();
