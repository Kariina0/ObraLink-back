class DiarioDTO {
  constructor(diario) {
    this.id = diario._id;
    this.obra = diario.obra;
    this.responsavel = diario.responsavel;
    this.data = diario.data;
    this.clima = diario.clima;
    this.equipamentos = diario.equipamentos;
    this.maoDeObra = diario.maoDeObra;
    this.atividades = diario.atividades;
    this.materiais = diario.materiais;
    this.ocorrencias = diario.ocorrencias;
    this.visitantes = diario.visitantes;
    this.fotos = diario.fotos;
    this.observacoesGerais = diario.observacoesGerais;
    this.assinatura = diario.assinatura;
    this.sincronizado = diario.sincronizado;
    this.syncId = diario.syncId;
    this.clientTimestamp = diario.clientTimestamp;
    this.createdAt = diario.metadata?.createdAt;
    this.updatedAt = diario.metadata?.updatedAt;
  }
}

module.exports = DiarioDTO;
