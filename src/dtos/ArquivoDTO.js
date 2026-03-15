class ArquivoDTO {
  constructor(arquivo) {
    this.id = arquivo.id || arquivo._id;
    this.nome = arquivo.nome;
    this.nomeOriginal = arquivo.nomeOriginal;
    // URL de acesso ao arquivo (URL assinada quando Supabase, path relativo quando local)
    this.url = arquivo.storage_url || arquivo.url;
    this.tipo = arquivo.tipo;
    this.tipoArquivo = arquivo.tipoArquivo || null;
    this.mimeType = arquivo.mimeType;
    this.tamanho = arquivo.tamanho;
    this.tamanhoOriginal = arquivo.tamanhoOriginal;
    this.dimensoes = arquivo.dimensoes;
    this.coordenadas = arquivo.coordenadas;
    this.descricao = arquivo.descricao;
    this.detalheProblema = arquivo.detalheProblema || null;
    this.solicitadoPor = arquivo.solicitadoPor || null;
    this.tags = arquivo.tags;
    this.obra = arquivo.obra;
    this.uploadedBy = arquivo.uploadedBy;
    this.comprimido = arquivo.comprimido;
    this.sincronizado = arquivo.sincronizado;
    this.syncId = arquivo.syncId;
    // Campos de storage
    this.storageProvider = arquivo.storage_provider || "local";

    const meta = ArquivoDTO._parseJson(arquivo.metadata, {});
    this.createdAt = arquivo.created_at || meta.createdAt;
    this.updatedAt = arquivo.updated_at || meta.updatedAt;
  }

  static _parseJson(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return fallback; }
  }
}

module.exports = ArquivoDTO;
