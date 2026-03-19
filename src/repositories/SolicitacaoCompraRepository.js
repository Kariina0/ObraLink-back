const BaseRepository = require("./BaseRepository");

class SolicitacaoCompraRepository extends BaseRepository {
  constructor() {
    super("solicitacoes_compra");
  }

  async findBySyncId(syncId) {
    return this.findOne({ syncId });
  }

  async findByObra(obraId, options = {}) {
    return this.findAll({ obra: obraId }, options);
  }

  async findBySolicitante(userId, options = {}) {
    return this.findAll({ solicitante: userId }, options);
  }

  async findByStatus(status, options = {}) {
    return this.findAll({ status }, options);
  }

  async findPendentes(options = {}) {
    return this.findAll({ sincronizado: false }, options);
  }

  async findByPrioridade(prioridade, options = {}) {
    return this.findAll(
      { prioridade, status: "pendente" },
      { ...options, sort: { dataNecessidade: "asc" } },
    );
  }

  /**
   * Busca todas as solicitações e enriquece com nomes de solicitante e aprovador
   */
  async findAllWithUsers(filters = {}, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    // Construir a query base
    let query = this.supabase
      .from(this.table)
      .select("*", { count: "exact" });

    // Aplicar filtros
    if (filters.solicitante) {
      query = query.eq("solicitante", Number(filters.solicitante));
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.obra) {
      query = query.eq("obra", Number(filters.obra));
    }
    if (filters.prioridade) {
      query = query.eq("prioridade", filters.prioridade);
    }

    // Ordenar e paginar
    query = query
      .order("dataSolicitacao", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: rawRows, error, count } = await query;
    if (error) throw error;

    const rows = rawRows ?? [];

    // Extrair IDs únicos de solicitantes e aprovadores
    const solicitanteIds = [...new Set(rows.map((r) => r.solicitante).filter(Boolean))];
    const aprovadorIds = [...new Set(rows.map((r) => r.aprovadoPor).filter(Boolean))];
    const obraIds = [...new Set(rows.map((r) => r.obra).filter(Boolean))];

    // Buscar nomes de usuários em paralelo
    const [solicitantesRes, aprovadoresRes, obrasRes] = await Promise.all([
      solicitanteIds.length
        ? this.supabase.from("users").select("id,nome").in("id", solicitanteIds)
        : Promise.resolve({ data: [], error: null }),
      aprovadorIds.length
        ? this.supabase.from("users").select("id,nome").in("id", aprovadorIds)
        : Promise.resolve({ data: [], error: null }),
      obraIds.length
        ? this.supabase.from("obras").select("id,nome").in("id", obraIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (solicitantesRes.error) throw solicitantesRes.error;
    if (aprovadoresRes.error) throw aprovadoresRes.error;
    if (obrasRes.error) throw obrasRes.error;

    // Mapear IDs para nomes
    const solicitanteById = new Map(
      (solicitantesRes.data ?? []).map((u) => [Number(u.id), u.nome])
    );
    const aprovadorById = new Map(
      (aprovadoresRes.data ?? []).map((u) => [Number(u.id), u.nome])
    );
    const obraById = new Map((obrasRes.data ?? []).map((o) => [Number(o.id), o.nome]));

    // Enriquecer os dados com nomes
    const enrichedRows = rows.map((row) => ({
      ...row,
      solicitanteNome: solicitanteById.get(Number(row.solicitante)) ?? null,
      aprovadoPorNome: aprovadorById.get(Number(row.aprovadoPor)) ?? null,
      obraNome: obraById.get(Number(row.obra)) ?? null,
    }));

    return { data: enrichedRows, total: count ?? 0, page, limit };
  }

  /**
   * Busca solicitação por ID e enriquece com nomes de solicitante e aprovador
   */
  async findByIdWithUsers(solicitacaoId) {
    const solicitacao = await this.findById(solicitacaoId);

    // Extrair IDs de solicitante e aprovador
    const solicitanteId = solicitacao.solicitante;
    const aprovadorId = solicitacao.aprovadoPor;
    const obraId = solicitacao.obra;

    // Buscar nomes em paralelo (apenas se IDs existem)
    const [solicitanteRes, aprovadorRes, obraRes] = await Promise.all([
      solicitanteId
        ? this.supabase.from("users").select("id,nome").eq("id", solicitanteId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      aprovadorId
        ? this.supabase.from("users").select("id,nome").eq("id", aprovadorId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      obraId
        ? this.supabase.from("obras").select("id,nome").eq("id", obraId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (solicitanteRes.error) throw solicitanteRes.error;
    if (aprovadorRes.error) throw aprovadorRes.error;
    if (obraRes.error) throw obraRes.error;

    // Enriquecer o objeto com nomes
    return {
      ...solicitacao,
      solicitanteNome: solicitanteRes.data?.nome ?? null,
      aprovadoPorNome: aprovadorRes.data?.nome ?? null,
      obraNome: obraRes.data?.nome ?? null,
    };
  }

  async aprovar(solicitacaoId, aprovadoPor) {
    return this.update(solicitacaoId, {
      status: "aprovada",
      aprovadoPor,
      dataAprovacao: new Date().toISOString(),
    });
  }

  async rejeitar(solicitacaoId, motivoRejeicao, aprovadoPor) {
    return this.update(solicitacaoId, {
      status: "rejeitada",
      aprovadoPor,
      motivoRejeicao,
      dataAprovacao: new Date().toISOString(),
    });
  }

  async concluir(solicitacaoId, dados) {
    return this.update(solicitacaoId, {
      status: "concluida",
      dataConclusao: new Date().toISOString(),
      ...dados,
    });
  }

  async markAsSynced(solicitacaoId) {
    return this.update(solicitacaoId, { sincronizado: true });
  }
}

module.exports = new SolicitacaoCompraRepository();
