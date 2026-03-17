const BaseRepository = require("./BaseRepository");

class DiarioRepository extends BaseRepository {
  constructor() {
    super("diarios");
  }

  async findBySyncId(syncId) {
    return this.findOne({ syncId });
  }

  async findByObra(obraId, options = {}) {
    return this.findAll({ obra: obraId }, options);
  }

  /**
   * Busca o diário de um dia específico de uma obra.
   * Filtra por intervalo [00:00:00, 23:59:59] da data informada.
   */
  async findByData(obraId, data) {
    const inicio = new Date(data);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(data);
    fim.setHours(23, 59, 59, 999);

    const { data: rows, error } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = this.supabase
        .from(this.table)
        .select("*")
        .eq("obra", obraId)
        .gte("data", inicio.toISOString())
        .lte("data", fim.toISOString());

      if (withDeletedAt) {
        query = query.is("deletedAt", null);
      }

      return query.maybeSingle();
    });

    if (error) throw error;
    return rows ?? null;
  }

  /**
   * Busca diários em um intervalo de datas, ordenados por data asc.
   */
  async findByPeriodo(obraId, dataInicio, dataFim, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const { data, error, count } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = this.supabase
        .from(this.table)
        .select("*", { count: "exact" })
        .eq("obra", obraId)
        .gte("data", new Date(dataInicio).toISOString())
        .lte("data", new Date(dataFim).toISOString());

      if (withDeletedAt) {
        query = query.is("deletedAt", null);
      }

      return query
        .order("data", { ascending: true })
        .range(offset, offset + limit - 1);
    });

    if (error) throw error;
    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  async findPendentes(options = {}) {
    return this.findAll({ sincronizado: false }, options);
  }

  async markAsSynced(diarioId) {
    return this.update(diarioId, { sincronizado: true });
  }

  async addOcorrencia(diarioId, ocorrencia) {
    const diario = await this.findById(diarioId);
    let ocorrencias;
    try {
      ocorrencias = diario.ocorrencias ? JSON.parse(diario.ocorrencias) : [];
    } catch (_) {
      ocorrencias = [];
    }
    ocorrencias.push(ocorrencia);
    return this.update(diarioId, { ocorrencias: JSON.stringify(ocorrencias) });
  }

  async addVisitante(diarioId, visitante) {
    const diario = await this.findById(diarioId);
    let visitantes;
    try {
      visitantes = diario.visitantes ? JSON.parse(diario.visitantes) : [];
    } catch (_) {
      visitantes = [];
    }
    visitantes.push(visitante);
    return this.update(diarioId, { visitantes: JSON.stringify(visitantes) });
  }
}

module.exports = new DiarioRepository();
