const express = require("express");
const router = express.Router();
const Measurement = require("../models/Measurement");

// Criar medição
router.post("/", async (req, res) => {
  try {

    const novaMedicao = await Measurement.create(req.body);

    res.json(novaMedicao);

  } catch (error) {

    res.status(500).json({
      error: "Erro ao salvar medição"
    });

  }
});


// LISTAR medições  ← ESSA ROTA FALTANDO CAUSA O ERRO
router.get("/", async (req, res) => {
  try {

    const medicoes = await Measurement.find().sort({ createdAt: -1 });

    res.json(medicoes);

  } catch (error) {

    res.status(500).json({
      error: "Erro ao buscar medições"
    });

  }
});

module.exports = router;