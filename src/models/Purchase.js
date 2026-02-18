const mongoose = require("mongoose");

const PurchaseSchema = new mongoose.Schema({
  items: [
    {
      material: String,
      medida: String,
    },
  ],
  status: {
    type: String,
    enum: ["Aprovado", "Em análise", "Negado"],
    default: "Em análise",
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuarios", // ou "User", dependendo do seu model
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Purchase", PurchaseSchema);
