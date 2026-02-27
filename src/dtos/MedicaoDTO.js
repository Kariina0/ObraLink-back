class MedicaoDTO {
  constructor(medicao) {
    this.id = medicao.id || medicao._id;
    this.obra = medicao.obra;
    this.responsavel = medicao.responsavel;
    this.data = medicao.data;

    // SQLite armazena JSON como string — parsear se necessário
    this.periodo = MedicaoDTO._parseJson(medicao.periodo);
    this.itens    = MedicaoDTO._parseJson(medicao.itens, []);
    this.anexos   = MedicaoDTO._parseJson(medicao.anexos, []);

    this.observacoes = medicao.observacoes;
    this.status = medicao.status;
    this.aprovadoPor = medicao.aprovadoPor;
    this.dataAprovacao = medicao.dataAprovacao;
    this.sincronizado = medicao.sincronizado;
    this.syncId = medicao.syncId;
    this.clientTimestamp = medicao.clientTimestamp;

    const meta = MedicaoDTO._parseJson(medicao.metadata, {});
    this.createdAt = medicao.created_at || meta.createdAt;
    this.updatedAt = medicao.updated_at || meta.updatedAt;

    // Calcular total somente quando itens é um array
    this.valorTotal = Array.isArray(this.itens)
      ? this.itens.reduce((total, item) => total + (Number(item.valorTotal) || 0), 0)
      : 0;
  }

  static _parseJson(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
}

module.exports = MedicaoDTO;
