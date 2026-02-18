const mongoose = require("mongoose");

const obraSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: [true, "Nome da obra é obrigatório"],
      trim: true,
    },
    codigo: {
      type: String,
      required: [true, "Código da obra é obrigatório"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    endereco: {
      logradouro: String,
      numero: String,
      complemento: String,
      bairro: String,
      cidade: String,
      estado: String,
      cep: String,
    },
    coordenadas: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
      },
    },
    responsavel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Responsável é obrigatório"],
    },
    equipe: [
      {
        usuario: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        funcao: String,
        dataInclusao: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    dataInicio: {
      type: Date,
      required: [true, "Data de início é obrigatória"],
    },
    dataPrevisaoTermino: Date,
    dataTermino: Date,
    status: {
      type: String,
      enum: [
        "planejamento",
        "em_andamento",
        "pausada",
        "concluida",
        "cancelada",
      ],
      default: "planejamento",
    },
    orcamento: {
      valor: Number,
      valorGasto: {
        type: Number,
        default: 0,
      },
    },
    descricao: String,
    observacoes: String,
    syncId: {
      type: String,
      unique: true,
      sparse: true,
    },
    metadata: {
      createdAt: {
        type: Date,
        default: Date.now,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
      deletedAt: {
        type: Date,
        default: null,
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
  },
  {
    timestamps: false,
  },
);

// Índices
obraSchema.index({ codigo: 1 });
obraSchema.index({ responsavel: 1 });
obraSchema.index({ status: 1 });
obraSchema.index({ syncId: 1 });
obraSchema.index({ "metadata.deletedAt": 1 });

// Atualizar updatedAt
obraSchema.pre("save", function (next) {
  this.metadata.updatedAt = new Date();
  next();
});

// Query helper para excluir deletados
obraSchema.query.notDeleted = function () {
  return this.where({ "metadata.deletedAt": null });
};

module.exports = mongoose.model("Obra", obraSchema);
