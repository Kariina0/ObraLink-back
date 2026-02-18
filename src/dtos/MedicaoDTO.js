class MedicaoDTO {
  constructor(medicao) {
    this.id = medicao._id;
    this.obra = medicao.obra;
    this.responsavel = medicao.responsavel;
    this.data = medicao.data;
    this.periodo = medicao.periodo;
    this.itens = medicao.itens;
    this.anexos = medicao.anexos;
    this.observacoes = medicao.observacoes;
    this.status = medicao.status;
    this.aprovadoPor = medicao.aprovadoPor;
    this.dataAprovacao = medicao.dataAprovacao;
    this.sincronizado = medicao.sincronizado;
    this.syncId = medicao.syncId;
    this.clientTimestamp = medicao.clientTimestamp;
    this.createdAt = medicao.metadata?.createdAt;
    this.updatedAt = medicao.metadata?.updatedAt;

    // Calcular total
    this.valorTotal = medicao.itens?.reduce(
      (total, item) => total + (item.valorTotal || 0),
      0,
    );
  }
}

module.exports = MedicaoDTO;
