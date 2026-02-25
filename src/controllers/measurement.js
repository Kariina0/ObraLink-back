const Measurement = require("../models/Measurement");
const database = require("../config/database");

// Cria uma medição. Suporta SQLite (Knex) e MongoDB (Mongoose).
const createMeasurement = async (req, res) => {
  try {
    const payload = req.body || {};

    // Se Knex estiver disponível, insere diretamente na tabela `measurements`
    if (database && database.knex) {
      const cols = await database.knex("measurements").columnInfo();
      // filtrar colunas desconhecidas
      const insertRow = Object.fromEntries(Object.entries(payload).filter(([k]) => Object.keys(cols || {}).includes(k)));
      const inserted = await database.knex("measurements").insert(insertRow);
      const id = Array.isArray(inserted) ? inserted[0] : inserted;
      const row = await database.knex("measurements").where({ id }).first();
      return res.status(201).json(row);
    }

    // Fallback para Mongoose model
    if (Measurement && typeof Measurement.create === "function") {
      const novaMedicao = await Measurement.create(payload);
      return res.status(201).json(novaMedicao);
    }

    return res.status(500).json({ error: "Driver de banco não disponível" });
  } catch (error) {
    const logger = require("../utils/logger");
    logger.error("Erro ao salvar medição:", error);
    return res.status(500).json({ error: "Erro ao salvar medição" });
  }
};

// Lista medições (paginação simples). Suporta SQLite (Knex) e MongoDB (Mongoose).
const getMeasurements = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);
    const offset = (page - 1) * limit;

    if (database && database.knex) {
      const data = await database.knex("measurements").orderBy("created_at", "desc").limit(limit).offset(offset);
      const totalRes = await database.knex("measurements").count({ count: "*" }).first();
      const total = totalRes ? Number(totalRes.count || totalRes['count(*)'] || 0) : 0;
      return res.json({ data, total, page, limit });
    }

    if (Measurement && typeof Measurement.find === "function") {
      const medicoes = await Measurement.find().sort({ createdAt: -1 }).skip(offset).limit(limit);
      const total = await Measurement.countDocuments();
      return res.json({ data: medicoes, total, page, limit });
    }

    return res.status(500).json({ error: "Driver de banco não disponível" });
  } catch (error) {
    const logger = require("../utils/logger");
    logger.error("Erro ao buscar medições:", error);
    return res.status(500).json({ error: "Erro ao buscar medições" });
  }
};

module.exports = { createMeasurement, getMeasurements };