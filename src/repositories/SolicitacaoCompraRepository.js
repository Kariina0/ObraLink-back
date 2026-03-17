const BaseRepository = require("./BaseRepository");

class SolicitacaoCompraRepository extends BaseRepository {
  constructor() {
    super("solicitacoes_compra");
  }

  async findBySyncId(syncId) {
    return this.findOne({ syncId });
  }

  async findByObra(obraId, options = {}) {
    return this.findAll({ obra: obraId }, options);
  }

  async findBySolicitante(userId, options = {}) {
    return this.findAll({ solicitante: userId }, options);
  }

  async findByStatus(status, options = {}) {
    return this.findAll({ status }, options);
  }

  async findPendentes(options = {}) {
    return this.findAll({ sincronizado: false }, options);
  }

  async findByPrioridade(prioridade, options = {}) {
    return this.findAll(
      { prioridade, status: "pendente" },
      { ...options, sort: { dataNecessidade: "asc" } },
    );
  }

  async aprovar(solicitacaoId, aprovadoPor) {
    return this.update(solicitacaoId, {
      status: "aprovada",
      aprovadoPor,
      dataAprovacao: new Date().toISOString(),
    });
  }

  async rejeitar(solicitacaoId, motivoRejeicao, aprovadoPor) {
    return this.update(solicitacaoId, {
      status: "rejeitada",
      aprovadoPor,
      motivoRejeicao,
      dataAprovacao: new Date().toISOString(),
    });
  }

  async concluir(solicitacaoId, dados) {
    return this.update(solicitacaoId, {
      status: "concluida",
      dataConclusao: new Date().toISOString(),
      ...dados,
    });
  }

  async markAsSynced(solicitacaoId) {
    return this.update(solicitacaoId, { sincronizado: true });
  }
}

module.exports = new SolicitacaoCompraRepository();
