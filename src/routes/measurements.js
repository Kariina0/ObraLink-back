const express = require("express");
const router = express.Router();

const {
  createMeasurement,
  getMeasurements,
} = require("../controllers/measurement");

// Criar medição
router.post("/", createMeasurement);

// Listar medições
router.get("/", getMeasurements);

module.exports = router;