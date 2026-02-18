const mongoose = require("mongoose");
const { TIPOS_ARQUIVO } = require("../constants");

const arquivoSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: [true, "Nome do arquivo é obrigatório"],
    },
    nomeOriginal: {
      type: String,
      required: [true, "Nome original é obrigatório"],
    },
    caminho: {
      type: String,
      required: [true, "Caminho do arquivo é obrigatório"],
    },
    url: String,
    tipo: {
      type: String,
      enum: Object.values(TIPOS_ARQUIVO),
      default: TIPOS_ARQUIVO.OUTROS,
    },
    mimeType: {
      type: String,
      required: [true, "Tipo MIME é obrigatório"],
    },
    tamanho: {
      type: Number,
      required: [true, "Tamanho do arquivo é obrigatório"],
    },
    dimensoes: {
      largura: Number,
      altura: Number,
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
    descricao: String,
    tags: [String],
    obra: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Obra",
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Usuário que fez upload é obrigatório"],
    },
    comprimido: {
      type: Boolean,
      default: false,
    },
    tamanhoOriginal: Number,
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
    },
  },
  {
    timestamps: false,
  },
);

// Índices
arquivoSchema.index({ obra: 1 });
arquivoSchema.index({ uploadedBy: 1 });
arquivoSchema.index({ tipo: 1 });
arquivoSchema.index({ sincronizado: 1 });
arquivoSchema.index({ syncId: 1 });
arquivoSchema.index({ "metadata.createdAt": -1 });
arquivoSchema.index({ "metadata.deletedAt": 1 });

// Atualizar updatedAt
arquivoSchema.pre("save", function (next) {
  this.metadata.updatedAt = new Date();
  next();
});

// Query helper para excluir deletados
arquivoSchema.query.notDeleted = function () {
  return this.where({ "metadata.deletedAt": null });
};

module.exports = mongoose.model("Arquivo", arquivoSchema);
