const mongoose = require("mongoose");

const diarioSchema = new mongoose.Schema(
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
      required: [true, "Data do diário é obrigatória"],
      default: Date.now,
      validate: {
        validator: function (v) {
          // Não permite datas futuras
          return v <= new Date();
        },
        message: "Data não pode ser futura",
      },
    },
    clima: {
      condicao: {
        type: String,
        enum: ["ensolarado", "nublado", "chuvoso", "ventoso", "outro"],
      },
      temperatura: Number,
      observacoes: String,
    },
    equipamentos: [
      {
        nome: String,
        quantidade: Number,
        horasTrabalhadas: Number,
        observacoes: String,
      },
    ],
    maoDeObra: [
      {
        funcao: String,
        quantidade: Number,
        horasTrabalhadas: Number,
        observacoes: String,
      },
    ],
    atividades: [
      {
        descricao: {
          type: String,
          required: [true, "Descrição da atividade é obrigatória"],
        },
        local: String,
        percentualConclusao: {
          type: Number,
          min: 0,
          max: 100,
        },
        responsaveis: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        ],
        observacoes: String,
      },
    ],
    materiais: [
      {
        descricao: String,
        quantidade: Number,
        unidade: String,
        fornecedor: String,
      },
    ],
    ocorrencias: [
      {
        tipo: {
          type: String,
          enum: [
            "atraso",
            "acidente",
            "problema_tecnico",
            "falta_material",
            "outro",
          ],
        },
        descricao: String,
        gravidade: {
          type: String,
          enum: ["baixa", "media", "alta"],
        },
        acoes: String,
      },
    ],
    visitantes: [
      {
        nome: String,
        empresa: String,
        motivo: String,
        horarioEntrada: Date,
        horarioSaida: Date,
      },
    ],
    fotos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Arquivo",
      },
    ],
    observacoesGerais: String,
    assinatura: {
      responsavel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      data: Date,
    },
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
diarioSchema.index({ obra: 1, data: -1 });
diarioSchema.index({ responsavel: 1 });
diarioSchema.index({ sincronizado: 1 });
diarioSchema.index({ syncId: 1 });
diarioSchema.index({ "metadata.deletedAt": 1 });

// Garantir apenas um diário por obra por dia
diarioSchema.index({ obra: 1, data: 1 }, { unique: true });

// Atualizar updatedAt
diarioSchema.pre("save", function (next) {
  this.metadata.updatedAt = new Date();
  next();
});

// Query helper para excluir deletados
diarioSchema.query.notDeleted = function () {
  return this.where({ "metadata.deletedAt": null });
};

module.exports = mongoose.model("Diario", diarioSchema);
