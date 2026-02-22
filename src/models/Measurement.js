const mongoose = require("mongoose");

const measurementSchema = new mongoose.Schema({
  obra: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Project", 
    required: true 
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Usuarios", 
    required: true 
  },
  area: { 
    type: Number, 
    required: true 
  },
  notes: { 
    type: String 
  },
  status: { 
    type: String, 
    enum: ["pendente", "aprovada", "rejeitada"], 
    default: "pendente" 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date 
  },
  deletedAt: { 
    type: Date, 
    default: null 
  }
});

// Atualiza automaticamente o campo updatedAt
measurementSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Measurement", measurementSchema);
