class SolicitacaoCompraDTO {
  constructor(solicitacao) {
    this.id = solicitacao.id;
    this.obra = solicitacao.obra;
    this.obraNome = solicitacao.obraNome || null;
    this.solicitante = solicitacao.solicitante;
    // solicitanteNome é preenchido quando a query faz JOIN com a tabela users
    this.solicitanteNome = solicitacao.solicitanteNome || null;
    this.dataSolicitacao = solicitacao.dataSolicitacao;
    this.dataNecessidade = solicitacao.dataNecessidade;
    this.prioridade = solicitacao.prioridade;
    // PostgreSQL armazena JSON como TEXT — parsear se necessário
    this.itens = SolicitacaoCompraDTO._parseJson(solicitacao.itens, []);
    this.justificativa = solicitacao.justificativa;
    this.observacoes = solicitacao.observacoes;
    this.anexos = SolicitacaoCompraDTO._parseJson(solicitacao.anexos, []);
    this.status = solicitacao.status;
    this.aprovadoPor = solicitacao.aprovadoPor;
    this.aprovadoPorNome = solicitacao.aprovadoPorNome || null;
    this.dataAprovacao = solicitacao.dataAprovacao;
    this.motivoRejeicao = solicitacao.motivoRejeicao;
    this.dataConclusao = solicitacao.dataConclusao;
    this.notaFiscal = solicitacao.notaFiscal;
    this.valorTotal = solicitacao.valorTotal;
    this.sincronizado = solicitacao.sincronizado;
    this.syncId = solicitacao.syncId;
    this.clientTimestamp = solicitacao.clientTimestamp;
    this.metadata = SolicitacaoCompraDTO._parseJson(solicitacao.metadata, {});
    this.createdAt = solicitacao.created_at;
    this.updatedAt = solicitacao.updated_at;
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

module.exports = SolicitacaoCompraDTO;
