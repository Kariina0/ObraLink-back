class DiarioDTO {
  constructor(diario) {
    this.id = diario.id;
    this.obra = diario.obra;
    this.obraNome = diario.obraNome || null;
    this.responsavel = diario.responsavel;
    this.responsavelNome = diario.responsavelNome || null;
    this.data = diario.data;
    this.clima = diario.clima || null;

    // Campos armazenados como TEXT/JSON no PostgreSQL — deserializar se necessário
    this.atividades      = DiarioDTO._parseJson(diario.atividades, []);
    this.equipamentos    = DiarioDTO._parseJson(diario.equipamentos, []);
    this.maoDeObra       = DiarioDTO._parseJson(diario.maoDeObra, []);
    this.materiais       = DiarioDTO._parseJson(diario.materiais, []);
    this.ocorrencias     = DiarioDTO._parseJson(diario.ocorrencias, []);
    this.visitantes      = DiarioDTO._parseJson(diario.visitantes, []);
    this.fotos           = DiarioDTO._parseJson(diario.fotos, []);

    this.observacoesGerais = diario.observacoesGerais || null;
    this.sincronizado    = diario.sincronizado;
    this.syncId          = diario.syncId || null;
    this.clientTimestamp = diario.clientTimestamp || null;

    const meta = DiarioDTO._parseJson(diario.metadata, {});
    this.createdAt = diario.created_at || meta.createdAt || null;
    this.updatedAt = diario.updated_at || meta.updatedAt || null;
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
