const BaseRepository = require("./BaseRepository");

class DiarioRepository extends BaseRepository {
  constructor() {
    super("diarios");
  }

  _normalizeDateInput(value) {
    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    if (typeof value === "string") {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const [, year, month, day] = match;
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0));
      }
    }

    return new Date(value);
  }

  /**
   * Enriquece um array de diários com obraNome e responsavelNome.
   * Usa queries separadas em lote para evitar dependência de FK no schema cache do PostgREST.
   */
  async _enrichWithNames(rows) {
    if (!rows || rows.length === 0) return rows;

    const obraIds = [...new Set(rows.map((r) => r.obra).filter(Boolean))];
    const userIds = [...new Set(rows.map((r) => r.responsavel).filter(Boolean))];

    const [obrasRes, usersRes] = await Promise.all([
      obraIds.length > 0
        ? this.supabase.from("obras").select("id, nome").in("id", obraIds)
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? this.supabase.from("users").select("id, nome").in("id", userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const obraMap = Object.fromEntries(
      (obrasRes.data ?? []).map((o) => [o.id, o.nome]),
    );
    const userMap = Object.fromEntries(
      (usersRes.data ?? []).map((u) => [u.id, u.nome]),
    );

    return rows.map((row) => ({
      ...row,
      obraNome: obraMap[row.obra] ?? null,
      responsavelNome: userMap[row.responsavel] ?? null,
    }));
  }

  /**
   * Busca diário por ID incluindo obraNome e responsavelNome.
   */
  async findByIdWithNames(id) {
    const { NotFoundError } = require("../utils/errors");
    const { data, error } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = this.supabase
        .from(this.table)
        .select("*")
        .eq("id", id);
      if (withDeletedAt) {
        query = query.is("deletedAt", null);
      }
      return query.maybeSingle();
    });

    if (error) throw error;
    if (!data) throw new NotFoundError("Diário não encontrado");

    const enriched = await this._enrichWithNames([data]);
    return enriched[0];
  }

  /**
   * Lista diários com paginação incluindo obraNome e responsavelNome.
   * @param {object} filter - Filtros de igualdade simples.
   * @param {object} options - { page, limit }
   */
  async findAllWithNames(filter = {}, options = {}) {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    const { data, error, count } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = this.supabase
        .from(this.table)
        .select("*", { count: "exact" });

      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      if (withDeletedAt) {
        query = query.is("deletedAt", null);
      }

      return query
        .order("data", { ascending: false })
        .range(offset, offset + limit - 1);
    });

    if (error) throw error;

    const enriched = await this._enrichWithNames(data ?? []);
    return { data: enriched, total: count ?? 0, page, limit };
  }

  /**
   * Lista diários de um responsável em um período, com obraNome e responsavelNome.
   */
  async findByPeriodoResponsavel(userId, dataInicio, dataFim, options = {}) {
    const { page = 1, limit = 20, obraId } = options;
    const offset = (page - 1) * limit;

    const { data, error, count } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = this.supabase
        .from(this.table)
        .select("*", { count: "exact" })
        .eq("responsavel", userId)
        .gte("data", dataInicio.toISOString())
        .lte("data", dataFim.toISOString());

      if (obraId) query = query.eq("obra", obraId);
      if (withDeletedAt) query = query.is("deletedAt", null);

      return query
        .order("data", { ascending: false })
        .range(offset, offset + limit - 1);
    });

    if (error) throw error;

    const enriched = await this._enrichWithNames(data ?? []);
    return { data: enriched, total: count ?? 0, page, limit };
  }

  /**
   * Lista todos os diários em um período (supervisor/admin), com obraNome e responsavelNome.
   */
  async findByPeriodoGlobal(dataInicio, dataFim, options = {}) {
    const { page = 1, limit = 20, obraId } = options;
    const offset = (page - 1) * limit;

    const { data, error, count } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = this.supabase
        .from(this.table)
        .select("*", { count: "exact" })
        .gte("data", dataInicio.toISOString())
        .lte("data", dataFim.toISOString());

      if (obraId) query = query.eq("obra", obraId);
      if (withDeletedAt) query = query.is("deletedAt", null);

      return query
        .order("data", { ascending: false })
        .range(offset, offset + limit - 1);
    });

    if (error) throw error;

    const enriched = await this._enrichWithNames(data ?? []);
    return { data: enriched, total: count ?? 0, page, limit };
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
    const referencia = this._normalizeDateInput(data);
    const inicio = new Date(referencia);
    inicio.setUTCHours(0, 0, 0, 0);
    const fim = new Date(referencia);
    fim.setUTCHours(23, 59, 59, 999);
    const targetUtcDay = referencia.toISOString().slice(0, 10);
    const targetLocalDay = `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, "0")}-${String(referencia.getDate()).padStart(2, "0")}`;

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
    if (rows) return rows;

    // Fallback robusto para ambientes com serialização de datetime inconsistente
    // (ex.: SQLite em testes): compara apenas o dia UTC em memória.
    const { data: allRows, error: fallbackError } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = this.supabase
        .from(this.table)
        .select("*")
        .eq("obra", obraId);

      if (withDeletedAt) {
        query = query.is("deletedAt", null);
      }

      return query;
    });

    if (fallbackError) throw fallbackError;

    const match = (allRows || []).find((row) => {
      if (!row?.data) return false;
      const normalized = this._normalizeDateInput(row.data);
      if (Number.isNaN(normalized.getTime())) return false;
      const rowUtcDay = normalized.toISOString().slice(0, 10);
      const rowLocalDay = `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}-${String(normalized.getDate()).padStart(2, "0")}`;
      return (
        rowUtcDay === targetUtcDay
        || rowLocalDay === targetLocalDay
        || rowUtcDay === targetLocalDay
        || rowLocalDay === targetUtcDay
      );
    });

    return match || null;
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
