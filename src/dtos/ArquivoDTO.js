class ArquivoDTO {
  constructor(arquivo) {
    this.id = arquivo.id || arquivo._id;
    this.nome = arquivo.nome;
    this.nomeOriginal = arquivo.nomeOriginal;
    this.url = arquivo.url;
    this.tipo = arquivo.tipo;
    this.mimeType = arquivo.mimeType;
    this.tamanho = arquivo.tamanho;
    this.tamanhoOriginal = arquivo.tamanhoOriginal;
    this.dimensoes = arquivo.dimensoes;
    this.coordenadas = arquivo.coordenadas;
    this.descricao = arquivo.descricao;
    this.tags = arquivo.tags;
    this.obra = arquivo.obra;
    this.uploadedBy = arquivo.uploadedBy;
    this.comprimido = arquivo.comprimido;
    this.sincronizado = arquivo.sincronizado;
    this.syncId = arquivo.syncId;
    this.createdAt = arquivo.metadata?.createdAt;
    this.updatedAt = arquivo.metadata?.updatedAt;
  }
}

module.exports = ArquivoDTO;
