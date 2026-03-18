const BaseRepository = require("./BaseRepository");
const { ValidationError } = require("../utils/errors");

class ObraRepository extends BaseRepository {
  constructor() {
    super("obras");
  }

  async findByCodigo(codigo) {
    const { data, error } = await this.supabase
      .from(this.table)
      .select("*")
      .eq("codigo", codigo)
      .is("deletedAt", null)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  async findBySyncId(syncId) {
    return this.findOne({ syncId });
  }

  async findByResponsavel(userId, options = {}) {
    return this.findAll({ responsavel: userId }, options);
  }

  // ── N:N encarregado ──────────────────────────────────────────────────────

  /**
   * Retorna as obras às quais userId está vinculado como encarregado.
   * Usa obra_encarregados. Fallback para obraAtual do usuário se não houver vínculo.
   */
  async findByEncarregado(userId, options = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    // Busca IDs de obras via obra_encarregados
    const { data: vinculos } = await this.supabase
      .from("obra_encarregados")
      .select("obraId")
      .eq("userId", userId);

    const obraIds = (vinculos ?? []).map((v) => v.obraId);

    if (obraIds.length > 0) {
      let query = this.supabase
        .from(this.table)
        .select("*", { count: "exact" })
        .in("id", obraIds)
        .is("deletedAt", null);

      if (status) query = query.eq("status", status);
      query = query.range(offset, offset + limit - 1).order("created_at", { ascending: false });

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data ?? [], total: count ?? 0, page, limit };
    }

    // Fallback: usar obraAtual do registro do usuário
    const { data: user } = await this.supabase
      .from("users")
      .select("obraAtual")
      .eq("id", userId)
      .maybeSingle();

    if (!user?.obraAtual) {
      return { data: [], total: 0, page, limit };
    }

    let fallbackQuery = this.supabase
      .from(this.table)
      .select("*", { count: "exact" })
      .eq("id", user.obraAtual)
      .is("deletedAt", null);

    if (status) fallbackQuery = fallbackQuery.eq("status", status);
    fallbackQuery = fallbackQuery.range(offset, offset + limit - 1);

    const { data: fallbackData, error: fallbackErr, count: fallbackCount } = await fallbackQuery;
    if (fallbackErr) throw fallbackErr;
    return { data: fallbackData ?? [], total: fallbackCount ?? 0, page, limit };
  }

  /**
   * Verifica se um usuário está vinculado a uma obra como encarregado.
   * Fallback para obraAtual do usuário.
   */
  async isEncarregadoVinculado(obraId, userId) {
    const { data: vinculo } = await this.supabase
      .from("obra_encarregados")
      .select("id")
      .eq("obraId", Number(obraId))
      .eq("userId", Number(userId))
      .maybeSingle();

    if (vinculo) return true;

    // Fallback: verifica obraAtual
    const { data: user } = await this.supabase
      .from("users")
      .select("obraAtual")
      .eq("id", userId)
      .maybeSingle();

    return Number(user?.obraAtual) === Number(obraId);
  }

  /**
   * Vincula um encarregado a uma obra (upsert — idempotente).
   */
  async vincularEncarregado(obraId, userId, funcao = "encarregado") {
    const { error } = await this.supabase
      .from("obra_encarregados")
      .upsert(
        { obraId: Number(obraId), userId: Number(userId), funcao, dataInclusao: new Date().toISOString() },
        { onConflict: "obraId,userId", ignoreDuplicates: true },
      );

    if (error) throw error;
    return this.findById(obraId);
  }

  /**
   * Desvincula um encarregado de uma obra.
   */
  async desvincularEncarregado(obraId, userId) {
    const numObraId = Number(obraId);
    const numUserId = Number(userId);
    if (!numObraId || !numUserId) {
      throw new ValidationError("obraId e userId devem ser números válidos");
    }
    const { error } = await this.supabase
      .from("obra_encarregados")
      .delete()
      .eq("obraId", numObraId)
      .eq("userId", numUserId);

    if (error) throw error;
    return this.findById(obraId);
  }

  /**
   * Lista os encarregados vinculados a uma obra com dados do usuário via JOIN.
   */
  async listarEncarregados(obraId) {
    const { data, error } = await this.supabase
      .from("obra_encarregados")
      .select("id, obraId, userId, funcao, dataInclusao, users(id, nome, email, perfil)")
      .eq("obraId", Number(obraId))
      .order("dataInclusao", { ascending: true });

    if (error) throw error;
    return (data ?? []).map(({ users: u, ...enc }) => ({
      ...enc,
      nome: u?.nome,
      email: u?.email,
      perfil: u?.perfil,
    }));
  }

  /**
   * Carrega encarregados de várias obras em uma única query (evita N+1).
   * @param {number[]} obraIds
   * @returns {Object} mapa { obraId: [encarregados] }
   */
  async listarEncarregadosBatch(obraIds) {
    if (!obraIds || obraIds.length === 0) return {};

    const { data, error } = await this.supabase
      .from("obra_encarregados")
      .select("obraId, userId, funcao, dataInclusao, users(id, nome, email, perfil)")
      .in("obraId", obraIds);

    if (error) throw error;

    const result = {};
    for (const row of data ?? []) {
      const { obraId, users: u, ...enc } = row;
      if (!result[obraId]) result[obraId] = [];
      result[obraId].push({ ...enc, id: u?.id, nome: u?.nome, email: u?.email, perfil: u?.perfil });
    }
    return result;
  }

  /**
   * Retorna usuários ativos ainda não vinculados à obra como encarregados.
   * Usado para popular o seletor de adição de encarregados no frontend.
   * Administradores são excluídos da lista — não devem ser vinculados como encarregados.
   */
  async listarDisponiveisParaObra(obraId) {
    const { data: vinculos } = await this.supabase
      .from("obra_encarregados")
      .select("userId")
      .eq("obraId", Number(obraId));

    const linkedIds = (vinculos ?? []).map((v) => v.userId);

    let query = this.supabase
      .from("users")
      .select("id, nome, email, perfil")
      .is("deletedAt", null)
      .neq("perfil", "admin")
      .order("nome", { ascending: true });

    if (linkedIds.length > 0) {
      query = query.not("id", "in", `(${linkedIds.join(",")})`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Busca obras com filtros opcionais e suporte a busca textual por nome (ilike).
   * Substitui findAll no contexto de listagem pública de obras.
   */
  async findAllWithSearch(filters = {}, options = {}, q = null) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const { data, error, count } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = this.supabase
        .from(this.table)
        .select("*", { count: "exact" });
      if (withDeletedAt) query = this._applyNotDeleted(query);
      if (filters.status)      query = query.eq("status", filters.status);
      if (filters.responsavel) query = query.eq("responsavel", Number(filters.responsavel));
      if (q)                   query = query.ilike("nome", `%${q}%`);
      query = query
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });
      return query;
    });

    if (error) throw error;
    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  async findByEquipeMembro(userId, options = {}) {
    // equipe armazenada como JSON TEXT — filtro client-side (legado)
    const all = await this.findAll({}, { ...options, limit: 500 });
    const data = all.data.filter((o) => {
      try {
        const equipe = o.equipe ? JSON.parse(o.equipe) : [];
        return equipe.some((m) => String(m.usuario) === String(userId));
      } catch (_) {
        return false;
      }
    });
    return { data, total: data.length, page: 1, limit: data.length };
  }

  async addMembroEquipe(obraId, userId, funcao) {
    const obra = await this.findById(obraId);
    let equipe;
    try {
      equipe = obra.equipe ? JSON.parse(obra.equipe) : [];
    } catch (_) {
      equipe = [];
    }

    const jaExiste = equipe.some((m) => String(m.usuario) === String(userId));
    if (!jaExiste) {
      equipe.push({ usuario: userId, funcao, dataInclusao: new Date().toISOString() });
      await this.update(obraId, { equipe: JSON.stringify(equipe) });
    }
    return this.findById(obraId);
  }

  async removeMembroEquipe(obraId, userId) {
    const obra = await this.findById(obraId);
    let equipe;
    try {
      equipe = obra.equipe ? JSON.parse(obra.equipe) : [];
    } catch (_) {
      equipe = [];
    }

    equipe = equipe.filter((m) => String(m.usuario) !== String(userId));
    await this.update(obraId, { equipe: JSON.stringify(equipe) });
    return this.findById(obraId);
  }

  async updateStatus(obraId, status) {
    return this.update(obraId, { status });
  }

  async updateOrcamento(obraId, valorGasto) {
    const obra = await this.findById(obraId);
    let orcamento;
    try {
      orcamento = obra.orcamento ? JSON.parse(obra.orcamento) : {};
    } catch (_) {
      orcamento = {};
    }
    orcamento.valorGasto = (orcamento.valorGasto || 0) + valorGasto;
    return this.update(obraId, { orcamento: JSON.stringify(orcamento) });
  }

  async getObrasPorStatus(status, options = {}) {
    return this.findAll({ status }, options);
  }
}

module.exports = new ObraRepository();
