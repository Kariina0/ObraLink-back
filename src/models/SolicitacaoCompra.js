const mongoose = require("mongoose");
const { STATUS_SOLICITACAO, UNIDADES_MEDIDA } = require("../constants");

const solicitacaoCompraSchema = new mongoose.Schema(
  {
    obra: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Obra",
      required: [true, "Obra é obrigatória"],
    },
    solicitante: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Solicitante é obrigatório"],
    },
    dataSolicitacao: {
      type: Date,
      default: Date.now,
    },
    dataNecessidade: {
      type: Date,
      required: [true, "Data de necessidade é obrigatória"],
    },
    prioridade: {
      type: String,
      enum: ["baixa", "media", "alta", "urgente"],
      default: "media",
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
        especificacoes: String,
        valorEstimado: Number,
        fornecedorSugerido: String,
        observacoes: String,
      },
    ],
    justificativa: {
      type: String,
      required: [true, "Justificativa é obrigatória"],
    },
    observacoes: String,
    anexos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Arquivo",
      },
    ],
    status: {
      type: String,
      enum: Object.values(STATUS_SOLICITACAO),
      default: STATUS_SOLICITACAO.PENDENTE,
    },
    aprovadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    dataAprovacao: Date,
    motivoRejeicao: String,
    dataConclusao: Date,
    notaFiscal: String,
    valorTotal: Number,
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
solicitacaoCompraSchema.index({ obra: 1, dataSolicitacao: -1 });
solicitacaoCompraSchema.index({ solicitante: 1 });
solicitacaoCompraSchema.index({ status: 1 });
solicitacaoCompraSchema.index({ sincronizado: 1 });
solicitacaoCompraSchema.index({ syncId: 1 });
solicitacaoCompraSchema.index({ prioridade: 1 });
solicitacaoCompraSchema.index({ "metadata.deletedAt": 1 });

// Calcular valor total antes de salvar
solicitacaoCompraSchema.pre("save", function (next) {
  this.valorTotal = this.itens.reduce((total, item) => {
    return total + (item.valorEstimado || 0) * item.quantidade;
  }, 0);

  this.metadata.updatedAt = new Date();
  next();
});

// Validação de transição de status
solicitacaoCompraSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    const validTransitions = {
      [STATUS_SOLICITACAO.PENDENTE]: [
        STATUS_SOLICITACAO.APROVADA,
        STATUS_SOLICITACAO.REJEITADA,
      ],
      [STATUS_SOLICITACAO.APROVADA]: [STATUS_SOLICITACAO.CONCLUIDA],
      [STATUS_SOLICITACAO.REJEITADA]: [],
      [STATUS_SOLICITACAO.CONCLUIDA]: [],
    };

    // Implementar validação de transição se necessário
  }
  next();
});

// Query helper para excluir deletados
solicitacaoCompraSchema.query.notDeleted = function () {
  return this.where({ "metadata.deletedAt": null });
};

module.exports = mongoose.model("SolicitacaoCompra", solicitacaoCompraSchema);
