class DiarioDTO {
  constructor(diario) {
    this.id = diario.id || diario._id;
    this.obra = diario.obra;
    this.responsavel = diario.responsavel;
    this.data = diario.data;
    this.clima = diario.clima || null;
    this.equipamentos = DiarioDTO._parseJson(diario.equipamentos);
    this.maoDeObra = DiarioDTO._parseJson(diario.maoDeObra);
    this.atividades = DiarioDTO._parseJson(diario.atividades);
    this.materiais = DiarioDTO._parseJson(diario.materiais);
    this.ocorrencias = DiarioDTO._parseJson(diario.ocorrencias, []);
    this.visitantes = DiarioDTO._parseJson(diario.visitantes, []);
    this.fotos = DiarioDTO._parseJson(diario.fotos, []);
    this.observacoesGerais = diario.observacoesGerais || null;
    this.assinatura = diario.assinatura || null;
    this.sincronizado = diario.sincronizado;
    this.syncId = diario.syncId;
    this.clientTimestamp = diario.clientTimestamp;

    const meta = DiarioDTO._parseJson(diario.metadata, {});
    this.createdAt = diario.created_at || meta.createdAt;
    this.updatedAt = diario.updated_at || meta.updatedAt;
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

module.exports = DiarioDTO;
