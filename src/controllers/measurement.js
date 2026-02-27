const database = require("../config/database");
const logger = require("../utils/logger");

// Cria uma medição usando SQLite (Knex).
const createMeasurement = async (req, res) => {
  try {
    const payload = req.body || {};
    const cols = await database.knex("measurements").columnInfo();
    const insertRow = Object.fromEntries(
      Object.entries(payload).filter(([k]) => Object.keys(cols || {}).includes(k))
    );
    const inserted = await database.knex("measurements").insert(insertRow);
    const id = Array.isArray(inserted) ? inserted[0] : inserted;
    const row = await database.knex("measurements").where({ id }).first();
    return res.status(201).json(row);
  } catch (error) {
    logger.error("Erro ao salvar medição:", error);
    return res.status(500).json({ error: "Erro ao salvar medição" });
  }
};

// Lista medições (paginação simples) usando SQLite (Knex).
const getMeasurements = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);
    const offset = (page - 1) * limit;
    const data = await database.knex("measurements")
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset);
    const totalRes = await database.knex("measurements").count({ count: "*" }).first();
    const total = totalRes ? Number(totalRes.count || totalRes["count(*)"] || 0) : 0;
    return res.json({ data, total, page, limit });
  } catch (error) {
    logger.error("Erro ao buscar medições:", error);
    return res.status(500).json({ error: "Erro ao buscar medições" });
  }
};

module.exports = { createMeasurement, getMeasurements };