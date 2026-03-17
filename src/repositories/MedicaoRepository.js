const BaseRepository = require("./BaseRepository");

class MedicaoRepository extends BaseRepository {
  constructor() {
    super("medicoes");
  }

  _applyMeasurementFilters(query, filters = {}) {
    if (filters.obra) {
      query = query.eq("obra", Number(filters.obra));
    }
    if (filters.responsavel) {
      query = query.eq("responsavel", Number(filters.responsavel));
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.area) {
      query = query.eq("area", filters.area);
    }
    if (filters.tipoServico) {
      query = query.eq("tipoServico", filters.tipoServico);
    }
    if (filters.dataInicio) {
      query = query.gte("data", new Date(filters.dataInicio).toISOString());
    }
    if (filters.dataFim) {
      query = query.lte("data", new Date(filters.dataFim).toISOString());
    }

    return query;
  }

  async getStatusSummaryFiltered(filters = {}) {
    const statuses = ["enviada", "aprovada", "rejeitada", "rascunho"];

    const counts = await Promise.all(
      statuses.map(async (status) => {
        const { count, error } = await this._runWithDeletedAtFallback((withDeletedAt) => {
          let query = this.supabase
            .from(this.table)
            .select("id", { count: "exact", head: true });

          query = this._applyMeasurementFilters(query, { ...filters, status });
          if (withDeletedAt) {
            query = query.is("deletedAt", null);
          }

          return query;
        });

        if (error) throw error;
        return [status, count ?? 0];
      })
    );

    return Object.fromEntries(counts);
  }

  async findBySyncId(syncId) {
    return this.findOne({ syncId });
  }

  async findByObra(obraId, options = {}) {
    return this.findAll({ obra: obraId }, options);
  }

  async findByResponsavel(userId, options = {}) {
    return this.findAll({ responsavel: userId }, options);
  }

  /**
   * Busca medições de um responsável com filtros opcionais.
   */
  async findByResponsavelFiltered(userId, filters = {}, options = {}) {
    return this.findAllFiltered({ ...filters, responsavel: userId }, options);
  }

  async findPendentes(options = {}) {
    return this.findAll({ sincronizado: false }, options);
  }

  /**
   * Busca filtrada com JOINs via RPC get_medicoes_filtered (definida em supabase_rls_auth.sql).
   * Mantém obraNome e responsavelNome no payload — compatibilidade com frontend.
   */
  async findAllFiltered(filters = {}, options = {}) {
    const { page = 1, limit = 10 } = options;

    const params = {
      p_page:         page,
      p_limit:        limit,
      p_obra:         filters.obra         ? Number(filters.obra)        : null,
      p_responsavel:  filters.responsavel  ? Number(filters.responsavel) : null,
      p_status:       filters.status       ?? null,
      p_area:         filters.area         ?? null,
      p_tipo_servico: filters.tipoServico  ?? null,
      p_data_inicio:  filters.dataInicio ? new Date(filters.dataInicio).toISOString() : null,
      p_data_fim:     filters.dataFim    ? new Date(filters.dataFim).toISOString()    : null,
    };

    const { data, error } = await this.supabase.rpc("get_medicoes_filtered", params);
    if (!error) {
      const total = data?.length > 0 ? Number(data[0].total_count ?? 0) : 0;
      // Remove total_count do payload (campo interno de paginação)
      const rows = (data ?? []).map(({ total_count, ...row }) => row);
      return { data: rows, total, page, limit };
    }

    // Fallback para ambientes em que a RPC não existe ou está desatualizada no Supabase.
    const errorText = [error.message, error.details, error.hint]
      .filter(Boolean)
      .join(" ");

    const rpcMissing = errorText.includes("get_medicoes_filtered")
      && errorText.includes("schema cache");

    const rpcResultMismatch = /structure of query does not match function result type|returned type .* does not match expected type/i
      .test(errorText);

    if (!rpcMissing && !rpcResultMismatch) {
      throw error;
    }

    const offset = (page - 1) * limit;
    let query = this.supabase
      .from(this.table)
      .select("*", { count: "exact" })
      .is("deletedAt", null);

    query = this._applyMeasurementFilters(query, filters);

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: rawRows, error: fallbackError, count } = await query;
    if (fallbackError) throw fallbackError;

    const rows = rawRows ?? [];
    const obraIds = [...new Set(rows.map((r) => r.obra).filter(Boolean))];
    const responsavelIds = [...new Set(rows.map((r) => r.responsavel).filter(Boolean))];

    const [obrasRes, usersRes] = await Promise.all([
      obraIds.length
        ? this.supabase.from("obras").select("id,nome").in("id", obraIds)
        : Promise.resolve({ data: [], error: null }),
      responsavelIds.length
        ? this.supabase.from("users").select("id,nome").in("id", responsavelIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (obrasRes.error) throw obrasRes.error;
    if (usersRes.error) throw usersRes.error;

    const obraById = new Map((obrasRes.data ?? []).map((o) => [Number(o.id), o.nome]));
    const userById = new Map((usersRes.data ?? []).map((u) => [Number(u.id), u.nome]));

    const enrichedRows = rows.map((row) => ({
      ...row,
      obraNome: obraById.get(Number(row.obra)) ?? null,
      responsavelNome: userById.get(Number(row.responsavel)) ?? null,
    }));

    return { data: enrichedRows, total: count ?? 0, page, limit };
  }

  async findByPeriodo(obraId, dataInicio, dataFim, options = {}) {
    return this.findAllFiltered({ obra: obraId, dataInicio, dataFim }, options);
  }

  async updateStatus(medicaoId, status, aprovadoPor = null, motivoRejeicao = null) {
    const patch = { status };
    if (status === "aprovada" && aprovadoPor) {
      patch.aprovadoPor = aprovadoPor;
      patch.dataAprovacao = new Date().toISOString();
    }
    if (status === "rejeitada" && motivoRejeicao) {
      patch.motivoRejeicao = motivoRejeicao;
    }
    return this.update(medicaoId, patch);
  }

  async markAsSynced(medicaoId) {
    return this.update(medicaoId, { sincronizado: true });
  }

  /**
   * Soma (quantidade × valorUnitario) de todas as medições aprovadas da obra.
   * Usa RPC get_total_medicao_por_obra definida em supabase_rls_auth.sql.
   */
  async getTotalPorObra(obraId) {
    const { data, error } = await this.supabase.rpc("get_total_medicao_por_obra", {
      p_obra_id: Number(obraId),
    });
    if (error) throw error;
    return Number(data ?? 0);
  }
}

module.exports = new MedicaoRepository();
