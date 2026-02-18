const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { PERFIS } = require("../constants");

const userSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: [true, "Nome é obrigatório"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email é obrigatório"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email inválido"],
    },
    senha: {
      type: String,
      required: [true, "Senha é obrigatória"],
      minlength: 6,
      select: false,
    },
    perfil: {
      type: String,
      enum: Object.values(PERFIS),
      default: PERFIS.ENCARREGADO,
    },
    obraAtual: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Obra",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSync: {
      type: Date,
      default: null,
    },
    syncId: {
      type: String,
      unique: true,
      sparse: true,
    },
    refreshToken: {
      type: String,
      select: false,
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
userSchema.index({ email: 1 });
userSchema.index({ syncId: 1 });
userSchema.index({ "metadata.deletedAt": 1 });

// Hash da senha antes de salvar
userSchema.pre("save", async function (next) {
  if (!this.isModified("senha")) return next();

  this.senha = await bcrypt.hash(this.senha, 12);
  next();
});

// Atualizar updatedAt
userSchema.pre("save", function (next) {
  this.metadata.updatedAt = new Date();
  next();
});

// Método para comparar senha
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.senha);
};

// Método para verificar se o usuário foi deletado (soft delete)
userSchema.methods.isDeleted = function () {
  return this.metadata.deletedAt !== null;
};

// Query helper para excluir deletados
userSchema.query.notDeleted = function () {
  return this.where({ "metadata.deletedAt": null });
};

module.exports = mongoose.model("User", userSchema);
