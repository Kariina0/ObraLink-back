const BaseRepository = require("./BaseRepository");

class SolicitacaoCompraRepository extends BaseRepository {
  constructor() {
    super("solicitacoes_compra");
  }

  async findBySyncId(syncId) {
    return await this.findOne({ syncId });
  }

  async findByObra(obraId, options = {}) {
    return await this.findAll({ obra: obraId }, options);
  }

  async findBySolicitante(userId, options = {}) {
    return await this.findAll({ solicitante: userId }, options);
  }

  async findByStatus(status, options = {}) {
    return await this.findAll({ status }, options);
  }

  async findPendentes(options = {}) {
    return await this.findAll({ sincronizado: false }, options);
  }

  async findByPrioridade(prioridade, options = {}) {
    return await this.findAll({ prioridade, status: "pendente" }, { ...options, sort: { dataNecessidade: 1 } });
  }

  async aprovar(solicitacaoId, aprovadoPor) {
    return await this.update(solicitacaoId, { status: "aprovada", aprovadoPor, dataAprovacao: new Date() });
  }

  async rejeitar(solicitacaoId, motivoRejeicao, aprovadoPor) {
    return await this.update(solicitacaoId, { status: "rejeitada", aprovadoPor, motivoRejeicao, dataAprovacao: new Date() });
  }

  async concluir(solicitacaoId, dados) {
    return await this.update(solicitacaoId, { status: "concluida", dataConclusao: new Date(), ...dados });
  }

  async markAsSynced(solicitacaoId) {
    return await this.update(solicitacaoId, { sincronizado: true });
  }
}

module.exports = new SolicitacaoCompraRepository();
