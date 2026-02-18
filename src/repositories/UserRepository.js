const BaseRepository = require("./BaseRepository");
const User = require("../models/User");

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmail(email) {
    return await this.model
      .findOne({ email })
      .notDeleted()
      .select("+senha +refreshToken");
  }

  async findBySyncId(syncId) {
    return await this.model.findOne({ syncId }).notDeleted();
  }

  async updateRefreshToken(userId, refreshToken) {
    return await this.model.findByIdAndUpdate(
      userId,
      { refreshToken, "metadata.updatedAt": new Date() },
      { new: true },
    );
  }

  async clearRefreshToken(userId) {
    return await this.model.findByIdAndUpdate(
      userId,
      { refreshToken: null, "metadata.updatedAt": new Date() },
      { new: true },
    );
  }

  async findByObraAtual(obraId, options = {}) {
    return await this.findAll({ obraAtual: obraId }, options);
  }

  async updateLastSync(userId) {
    return await this.model.findByIdAndUpdate(
      userId,
      { lastSync: new Date(), "metadata.updatedAt": new Date() },
      { new: true },
    );
  }

  async exportUserData(userId) {
    const user = await this.findById(userId, ["obraAtual"]);

    // Buscar todos os dados relacionados ao usuário
    const Medicao = require("../models/Medicao");
    const Diario = require("../models/Diario");
    const SolicitacaoCompra = require("../models/SolicitacaoCompra");
    const Arquivo = require("../models/Arquivo");

    const [medicoes, diarios, solicitacoes, arquivos] = await Promise.all([
      Medicao.find({ responsavel: userId }).notDeleted(),
      Diario.find({ responsavel: userId }).notDeleted(),
      SolicitacaoCompra.find({ solicitante: userId }).notDeleted(),
      Arquivo.find({ uploadedBy: userId }).notDeleted(),
    ]);

    return {
      usuario: user,
      medicoes,
      diarios,
      solicitacoes,
      arquivos,
    };
  }
}

module.exports = new UserRepository();
