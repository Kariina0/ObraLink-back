const mongoose = require("mongoose");
const { UNIDADES_MEDIDA } = require("../constants");

const medicaoSchema = new mongoose.Schema(
  {
    obra: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Obra",
      required: [true, "Obra é obrigatória"],
    },
    responsavel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Responsável é obrigatório"],
    },
    data: {
      type: Date,
      required: [true, "Data da medição é obrigatória"],
      default: Date.now,
    },
    periodo: {
      inicio: Date,
      fim: Date,
    },
    itens: [
      {
        descricao: {
          type: String,
          required: [true, "Descrição do item é obrigatória"],
          trim: true,
        },
        quantidade: {
          type: Number,
          required: [true, "Quantidade é obrigatória"],
          min: [0, "Quantidade não pode ser negativa"],
        },
        unidade: {
          type: String,
          required: [true, "Unidade é obrigatória"],
          enum: UNIDADES_MEDIDA,
        },
        valorUnitario: Number,
        valorTotal: Number,
        observacoes: String,
        local: String,
      },
    ],
    anexos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Arquivo",
      },
    ],
    observacoes: String,
    status: {
      type: String,
      enum: ["rascunho", "enviada", "aprovada", "rejeitada"],
      default: "rascunho",
    },
    aprovadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    dataAprovacao: Date,
    sincronizado: {
      type: Boolean,
      default: false,
    },
    syncId: {
      type: String,
      unique: true,
      sparse: true,
    },
    clientTimestamp: Date,
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
medicaoSchema.index({ obra: 1, data: -1 });
medicaoSchema.index({ responsavel: 1 });
medicaoSchema.index({ sincronizado: 1 });
medicaoSchema.index({ syncId: 1 });
medicaoSchema.index({ status: 1 });
medicaoSchema.index({ "metadata.deletedAt": 1 });

// Calcular valores totais antes de salvar
medicaoSchema.pre("save", function (next) {
  this.itens.forEach((item) => {
    if (item.valorUnitario && item.quantidade) {
      item.valorTotal = item.valorUnitario * item.quantidade;
    }
  });
  this.metadata.updatedAt = new Date();
  next();
});

// Query helper para excluir deletados
medicaoSchema.query.notDeleted = function () {
  return this.where({ "metadata.deletedAt": null });
};

module.exports = mongoose.model("Medicao", medicaoSchema);
