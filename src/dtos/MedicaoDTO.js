class MedicaoDTO {
  constructor(medicao) {
    this.id = medicao.id || medicao._id;
    this.obra = medicao.obra;
    // obraNome é preenchido quando a query faz JOIN com a tabela obras
    this.obraNome = medicao.obraNome || null;
    this.responsavel = medicao.responsavel;
    // responsavelNome é preenchido quando a query faz JOIN com a tabela users
    this.responsavelNome = medicao.responsavelNome || null;
    this.data = medicao.data;
    this.area = medicao.area || null;
    this.tipoServico = medicao.tipoServico || null;
    // Dimensões brutas (adicionadas na migration 20260304_add_dimensoes_medicao)
    this.comprimento   = MedicaoDTO._toNumber(medicao.comprimento);
    this.largura       = MedicaoDTO._toNumber(medicao.largura);
    this.altura        = MedicaoDTO._toNumber(medicao.altura);
    this.areaCalculada = MedicaoDTO._toNumber(medicao.areaCalculada);
    this.volume        = MedicaoDTO._toNumber(medicao.volume);

    // PostgreSQL armazena JSON como TEXT — parsear se necessário
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
    // Lê da coluna dedicada primeiro; cai no metadata para registros anteriores à migration
    this.motivoRejeicao = medicao.motivoRejeicao || meta.motivoRejeicao || null;

    // Calcular total somente quando itens é um array
    this.valorTotal = Array.isArray(this.itens)
      ? this.itens.reduce((total, item) => total + (Number(item.valorTotal) || 0), 0)
      : 0;
  }

  /** Converte para número, retornando null em vez de NaN */
  static _toNumber(value) {
    if (value == null) return null;
    const n = Number(value);
    return isNaN(n) ? null : n;
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
