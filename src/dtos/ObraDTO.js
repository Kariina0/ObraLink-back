class ObraDTO {
  constructor(obra) {
    this.id = obra.id;
    this.nome = obra.nome;
    this.codigo = obra.codigo;
    this.cliente = obra.cliente;
    this.endereco = obra.endereco;
    this.responsavel = obra.responsavel;
    this.dataInicio = obra.dataInicio;
    this.dataPrevisaoTermino = obra.dataPrevisaoTermino;
    this.dataTermino = obra.dataTermino;
    this.status = obra.status;
    this.descricao = obra.descricao;
    this.observacoes = obra.observacoes;
    this.orcamento = ObraDTO._parseJson(obra.orcamento);
    this.equipe = ObraDTO._parseJson(obra.equipe, []);
    // Encarregados vindos da tabela N:N (hydrattados pelo service)
    this.encarregados = Array.isArray(obra.encarregados) ? obra.encarregados : [];
    this.syncId = obra.syncId;
    this.createdAt = obra.created_at;
    this.updatedAt = obra.updated_at;
  }

  static _parseJson(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return fallback; }
  }
}

module.exports = ObraDTO;
