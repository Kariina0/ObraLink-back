const BaseRepository = require("./BaseRepository");
const SolicitacaoCompra = require("../models/SolicitacaoCompra");

class SolicitacaoCompraRepository extends BaseRepository {
  constructor() {
    super(SolicitacaoCompra);
  }

  async findBySyncId(syncId) {
    return await this.model.findOne({ syncId }).notDeleted();
  }

  async findByObra(obraId, options = {}) {
    return await this.findAll(
      { obra: obraId },
      { ...options, populate: ["solicitante", "aprovadoPor", "anexos"] },
    );
  }

  async findBySolicitante(userId, options = {}) {
    return await this.findAll(
      { solicitante: userId },
      { ...options, populate: ["obra", "anexos"] },
    );
  }

  async findByStatus(status, options = {}) {
    return await this.findAll(
      { status },
      { ...options, populate: ["obra", "solicitante"] },
    );
  }

  async findPendentes(options = {}) {
    return await this.findAll(
      { sincronizado: false },
      { ...options, populate: ["obra", "solicitante"] },
    );
  }

  async findByPrioridade(prioridade, options = {}) {
    return await this.findAll(
      { prioridade, status: "pendente" },
      { ...options, sort: { dataNecessidade: 1 } },
    );
  }

  async aprovar(solicitacaoId, aprovadoPor) {
    return await this.model.findByIdAndUpdate(
      solicitacaoId,
      {
        status: "aprovada",
        aprovadoPor,
        dataAprovacao: new Date(),
        "metadata.updatedAt": new Date(),
      },
      { new: true },
    );
  }

  async rejeitar(solicitacaoId, motivoRejeicao, aprovadoPor) {
    return await this.model.findByIdAndUpdate(
      solicitacaoId,
      {
        status: "rejeitada",
        aprovadoPor,
        motivoRejeicao,
        dataAprovacao: new Date(),
        "metadata.updatedAt": new Date(),
      },
      { new: true },
    );
  }

  async concluir(solicitacaoId, dados) {
    return await this.model.findByIdAndUpdate(
      solicitacaoId,
      {
        status: "concluida",
        dataConclusao: new Date(),
        ...dados,
        "metadata.updatedAt": new Date(),
      },
      { new: true },
    );
  }

  async markAsSynced(solicitacaoId) {
    return await this.model.findByIdAndUpdate(
      solicitacaoId,
      { sincronizado: true, "metadata.updatedAt": new Date() },
      { new: true },
    );
  }
}

module.exports = new SolicitacaoCompraRepository();
