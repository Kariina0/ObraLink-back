const mongoose = require("mongoose");

const MeasurementSchema = new mongoose.Schema(
  {
    comprimento: {
      type: Number,
      required: true,
    },

    largura: {
      type: Number,
      required: true,
    },

    altura: {
      type: Number,
      required: true,
    },

    area: {
      type: Number,
      required: true,
    },

    volume: {
      type: Number,
      required: true,
    },

    observacoes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Measurement", MeasurementSchema);