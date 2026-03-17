const { NotFoundError } = require("../utils/errors");
const supabase = require("../config/supabaseClient");

/**
 * BaseRepository usando Supabase (PostgreSQL via supabase-js).
 *
 * Premissas pós-migração:
 *  - Todas as tabelas possuem coluna "deletedAt" TIMESTAMPTZ para soft-delete.
 *  - metadata é armazenado como TEXT (JSON serializado).
 *  - Todas as tabelas possuem created_at e updated_at (via trigger).
 */
class BaseRepository {
  /**
   * @param {string} table - Nome da tabela PostgreSQL.
   */
  constructor(table) {
    if (!table || typeof table !== "string") {
      throw new Error("BaseRepository requer o nome da tabela como string.");
    }
    this.table = table;
    // Compatibilidade retroativa: alguns repositórios filhos ainda testam this.model
    this.model = null;
  }

  /**
   * Acesso ao cliente Supabase para consultas avançadas nos repositórios filhos.
   * Use this.supabase nas subclasses em vez de this.knex.
   */
  get supabase() {
    return supabase;
  }

  // ── Helpers de soft-delete ─────────────────────────────────────────────────

  /**
   * Aplica filtro de soft-delete em uma query supabase-js.
   * Espera que a tabela tenha coluna "deletedAt" TIMESTAMPTZ.
   */
  _applyNotDeleted(query) {
    return query.is("deletedAt", null);
  }

  _isMissingDeletedAtColumn(error) {
    const message = String(error?.message || "").toLowerCase();
    return message.includes("deletedat") && message.includes("does not exist");
  }

  async _runWithDeletedAtFallback(runQuery) {
    const first = await runQuery(true);
    if (!first?.error || !this._isMissingDeletedAtColumn(first.error)) {
      return first;
    }
    return runQuery(false);
  }

  // ── CRUD Base ──────────────────────────────────────────────────────────────

  /**
   * Busca registro por ID. Lança NotFoundError se não encontrado ou deletado.
   * @param {number} id
   * @returns {Promise<object>}
   */
  async findById(id) {
    const { data, error } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = supabase.from(this.table).select("*").eq("id", id);
      if (withDeletedAt) {
        query = this._applyNotDeleted(query);
      }
      return query.maybeSingle();
    });

    if (error) throw error;
    if (!data) throw new NotFoundError("Registro não encontrado");
    return data;
  }

  /**
   * Busca o primeiro registro que satisfaça o filtro (objeto de igualdades).
   * Retorna null se não encontrado.
   * @param {object} filter
   * @returns {Promise<object|null>}
   */
  async findOne(filter = {}) {
    const { data, error } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = supabase.from(this.table).select("*");
      query = this._applyFilters(query, filter);
      if (withDeletedAt) {
        query = this._applyNotDeleted(query);
      }
      return query.maybeSingle();
    });

    if (error) throw error;
    return data ?? null;
  }

  /**
   * Lista registros paginados.
   * @param {object} filter - Filtros de igualdade.
   * @param {object} options - { page, limit, sort: { campo: 'asc'|'desc' } }
   * @returns {Promise<{ data, total, page, limit }>}
   */
  async findAll(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = { created_at: "desc" },
    } = options;

    const offset = (page - 1) * limit;

    const { data, error, count } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = supabase.from(this.table).select("*", { count: "exact" });
      query = this._applyFilters(query, filter);
      if (withDeletedAt) {
        query = this._applyNotDeleted(query);
      }
      query = this._applySort(query, sort);
      query = query.range(offset, offset + limit - 1);
      return query;
    });

    if (error) throw error;

    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  /**
   * Cria um registro. Injeta metadata.createdAt se não fornecido.
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(data) {
    const row = { ...data };

    // Injeta metadata.createdAt para compatibilidade com registros existentes
    if (!row.metadata) {
      row.metadata = JSON.stringify({ createdAt: new Date().toISOString() });
    } else if (typeof row.metadata === "object") {
      row.metadata = JSON.stringify({
        createdAt: new Date().toISOString(),
        ...row.metadata,
      });
    }

    const { data: created, error } = await supabase
      .from(this.table)
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return created;
  }

  /**
   * Atualiza um registro. Mescla metadata.updatedAt automaticamente.
   * @param {number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(id, data) {
    const row = { ...data };

    // Mescla metadata preservando campos existentes
    if (!row.metadata) {
      // Busca metadata atual para mesclar updatedAt sem sobrescrever outros campos
      const { data: existing } = await supabase
        .from(this.table)
        .select("metadata")
        .eq("id", id)
        .maybeSingle();

      if (existing) {
        let meta = {};
        try {
          meta = existing.metadata ? JSON.parse(existing.metadata) : {};
        } catch (_) {
          meta = {};
        }
        meta.updatedAt = new Date().toISOString();
        row.metadata = JSON.stringify(meta);
      }
    } else if (typeof row.metadata === "object") {
      row.metadata = JSON.stringify({
        ...row.metadata,
        updatedAt: new Date().toISOString(),
      });
    }

    const { data: updated, error } = await supabase
      .from(this.table)
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") throw new NotFoundError("Registro não encontrado");
      throw error;
    }
    return updated;
  }

  /**
   * Deleta um registro (soft-delete por padrão via coluna "deletedAt").
   * @param {number} id
   * @param {boolean} soft - true = soft-delete, false = hard-delete
   * @returns {Promise<object|true>}
   */
  async delete(id, soft = true) {
    if (soft) {
      // Verifica existência antes de atualizar
      const { data: existing, error: findErr } = await supabase
        .from(this.table)
        .select("id")
        .eq("id", id)
        .is("deletedAt", null)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!existing) throw new NotFoundError("Registro não encontrado");

      const { error } = await supabase
        .from(this.table)
        .update({ deletedAt: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      return true;
    }

    // Hard-delete
    const { error } = await supabase
      .from(this.table)
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  }

  /**
   * Verifica se existe ao menos um registro satisfazendo o filtro.
   * @param {object} filter
   * @returns {Promise<boolean>}
   */
  async exists(filter) {
    const { count, error } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = supabase
        .from(this.table)
        .select("id", { count: "exact", head: true });

      query = this._applyFilters(query, filter);
      if (withDeletedAt) {
        query = this._applyNotDeleted(query);
      }

      return query;
    });

    if (error) throw error;
    return (count ?? 0) > 0;
  }

  /**
   * Conta registros satisfazendo o filtro (excluindo soft-deletados).
   * @param {object} filter
   * @returns {Promise<number>}
   */
  async count(filter = {}) {
    const { count, error } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = supabase
        .from(this.table)
        .select("*", { count: "exact", head: true });

      query = this._applyFilters(query, filter);
      if (withDeletedAt) {
        query = this._applyNotDeleted(query);
      }

      return query;
    });

    if (error) throw error;
    return count ?? 0;
  }

  // ── Helpers internos ───────────────────────────────────────────────────────

  /**
   * Aplica um objeto de filtros de igualdade em uma query supabase-js.
   * Suporta valores null (usa .is() em vez de .eq()).
   */
  _applyFilters(query, filter = {}) {
    for (const [key, val] of Object.entries(filter)) {
      if (val === null || val === undefined) {
        query = query.is(key, null);
      } else {
        query = query.eq(key, val);
      }
    }
    return query;
  }

  /**
   * Aplica ordenação em uma query supabase-js.
   * Aceita:
   *   - string: nome da coluna (asc implícito)
   *   - objeto: { campo: 'asc'|'desc' } ou { campo: -1|1 } (legado Mongo-like)
   */
  _applySort(query, sort) {
    if (!sort) return query;

    if (typeof sort === "string") {
      return query.order(sort, { ascending: true });
    }

    if (typeof sort === "object") {
      const entries = Object.entries(sort);
      for (const [key, dir] of entries) {
        // Ignora campos JSON como 'metadata.createdAt' — usa created_at diretamente
        if (key.includes(".")) {
          const fallback = key.split(".").pop();
          const col = ["createdAt", "updatedAt"].includes(fallback)
            ? fallback.replace(/([A-Z])/g, "_$1").toLowerCase() // createdAt → created_at
            : "created_at";
          query = query.order(col, { ascending: dir !== "desc" && dir !== -1 });
        } else {
          query = query.order(key, { ascending: dir !== "desc" && dir !== -1 });
        }
      }
    }

    return query;
  }
}

module.exports = BaseRepository;
