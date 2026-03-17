/**
 * Mock do cliente Supabase para testes de integração.
 *
 * Envolve uma instância Knex (SQLite em memória) e expõe a mesma API
 * fluente do supabase-js, retornando { data, error, count } como esperado
 * pelo BaseRepository e repositórios filhos.
 *
 * Uso em arquivo de teste:
 *   jest.mock("../../src/config/supabaseClient", () =>
 *     require("../helpers/supabaseMock").createSupabaseMock(getKnexFn)
 *   );
 *
 *   onde getKnexFn é uma função que retorna a instância knex (ex: getTestDb, getFullDb).
 */

/**
 * Cria um mock do supabase compatível com a API supabase-js v2.
 * @param {() => import("knex").Knex} getKnex - Função que retorna a instância knex ativa.
 */
function createSupabaseMock(getKnex) {
  // ── Query Builder ────────────────────────────────────────────────────────────
  function buildQuery(table) {
    const state = {
      table,
      mode: "select",         // "select" | "insert" | "update" | "delete" | "upsert"
      filters: [],
      selectCols: "*",
      selectOpts: {},
      orderFields: [],
      limitVal: null,
      rangeFrom: null,
      rangeTo: null,
      isSingle: false,
      isMaybeSingle: false,
      insertData: null,
      insertSelect: false,
      updateData: null,
      updateSelect: false,
      isDelete: false,
      upsertData: null,
    };

    const qb = {
      // ── Projeção ──────────────────────────────────────────────────────────
      select(cols, opts = {}) {
        if (state.mode === "insert" || state.mode === "update") {
          state.insertSelect = true;
          state.updateSelect = true;
        } else {
          state.selectCols = cols || "*";
          state.selectOpts = opts;
        }
        return qb;
      },

      // ── Filtros ───────────────────────────────────────────────────────────
      eq(col, val)   { state.filters.push({ op: "eq",   col, val  }); return qb; },
      neq(col, val)  { state.filters.push({ op: "neq",  col, val  }); return qb; },
      gt(col, val)   { state.filters.push({ op: "gt",   col, val  }); return qb; },
      gte(col, val)  { state.filters.push({ op: "gte",  col, val  }); return qb; },
      lt(col, val)   { state.filters.push({ op: "lt",   col, val  }); return qb; },
      lte(col, val)  { state.filters.push({ op: "lte",  col, val  }); return qb; },

      is(col, val) {
        state.filters.push({ op: val === null ? "isNull" : "isNotNull", col });
        return qb;
      },
      in(col, vals)  { state.filters.push({ op: "in",   col, vals }); return qb; },
      not(col, op, val) {
        state.filters.push({ op: "not", col, subOp: op, val });
        return qb;
      },
      ilike(col, val) { state.filters.push({ op: "ilike", col, val }); return qb; },
      like(col, val)  { state.filters.push({ op: "like",  col, val }); return qb; },
      or(conditionStr) {
        state.filters.push({ op: "or", conditionStr });
        return qb;
      },
      contains(col, val) { state.filters.push({ op: "eq", col, val }); return qb; },

      // ── Ordenação / Paginação ─────────────────────────────────────────────
      order(col, opts = {}) {
        state.orderFields.push({ col, asc: opts.ascending !== false });
        return qb;
      },
      limit(n)             { state.limitVal = n; return qb; },
      range(from, to)      { state.rangeFrom = from; state.rangeTo = to; return qb; },

      // ── Cardinalidade ─────────────────────────────────────────────────────
      single()      { state.isSingle = true; return qb; },
      maybeSingle() { state.isMaybeSingle = true; return qb; },

      // ── Mutações ──────────────────────────────────────────────────────────
      insert(data) {
        state.mode = "insert";
        state.insertData = data;
        return qb;
      },
      update(data) {
        state.mode = "update";
        state.updateData = data;
        return qb;
      },
      delete() {
        state.mode = "delete";
        return qb;
      },
      upsert(data) {
        state.mode = "upsert";
        state.upsertData = data;
        return qb;
      },

      // ── Thenable (cada await executa a query) ─────────────────────────────
      then(resolve, reject) {
        return _execute(state, getKnex).then(resolve, reject);
      },
    };

    return qb;
  }

  // ── Executor principal ───────────────────────────────────────────────────────
  async function _execute(state, getKnex) {
    try {
      const knex = getKnex();

      // INSERT
      if (state.mode === "insert") {
        const rows = Array.isArray(state.insertData)
          ? state.insertData
          : [state.insertData];

        const ids = await knex(state.table).insert(rows);
        const lastId = Array.isArray(ids) ? ids[ids.length - 1] : ids;

        if (!state.insertSelect) {
          return { data: null, error: null };
        }

        // Retorna os dados inseridos (como supabase.insert().select().single())
        if (state.isSingle) {
          const row = await knex(state.table).where("id", lastId).first();
          return { data: row ?? null, error: null };
        }
        const insertedRows = await knex(state.table).whereIn("id", ids).select("*");
        return {
          data: Array.isArray(state.insertData) ? insertedRows : (insertedRows[0] ?? null),
          error: null,
        };
      }

      // UPDATE
      if (state.mode === "update") {
        let q = knex(state.table).update(state.updateData);
        q = _applyFilters(q, state.filters, knex);
        await q;

        if (!state.updateSelect) {
          return { data: null, error: null };
        }

        // Retorna linha atualizada — busca de volta com os mesmos filtros
        let selectQ = knex(state.table).select("*");
        selectQ = _applyFilters(selectQ, state.filters, knex);
        const rows = await selectQ;

        if (state.isSingle) {
          if (!rows || rows.length === 0) {
            return { data: null, error: { code: "PGRST116", message: "Not found" } };
          }
          return { data: rows[0], error: null };
        }
        return { data: rows, error: null };
      }

      // DELETE
      if (state.mode === "delete") {
        let q = knex(state.table).delete();
        q = _applyFilters(q, state.filters, knex);
        await q;
        return { data: null, error: null };
      }

      // UPSERT
      if (state.mode === "upsert") {
        const rows = Array.isArray(state.upsertData)
          ? state.upsertData
          : [state.upsertData];
        // SQLite não tem upsert nativo elegante — insert ou replace
        for (const row of rows) {
          if (row.id) {
            const existing = await knex(state.table).where("id", row.id).first();
            if (existing) {
              await knex(state.table).where("id", row.id).update(row);
            } else {
              await knex(state.table).insert(row);
            }
          } else {
            await knex(state.table).insert(row);
          }
        }
        return { data: rows.length === 1 ? rows[0] : rows, error: null };
      }

      // SELECT — modo padrão
      const isHeadCount =
        state.selectOpts &&
        state.selectOpts.head === true &&
        state.selectOpts.count === "exact";

      const isCountOnly =
        !isHeadCount &&
        state.selectOpts &&
        state.selectOpts.count === "exact";

      let q = knex(state.table);

      if (!isHeadCount) {
        // Colunas
        const cols = _parseSelectCols(state.selectCols);
        q = q.select(cols);
      }

      q = _applyFilters(q, state.filters, knex);

      // Para count/head apenas conta
      if (isHeadCount) {
        const countResult = await knex(state.table)
          .modify((b) => _applyFilters(b, state.filters, knex))
          .count("* as cnt")
          .first();
        const total = Number(countResult?.cnt ?? 0);
        return { data: null, count: total, error: null };
      }

      // ORDER BY
      for (const o of state.orderFields) {
        q = q.orderBy(o.col, o.asc ? "asc" : "desc");
      }

      // LIMIT simples
      if (state.limitVal !== null) {
        q = q.limit(state.limitVal);
      }

      // RANGE (paginação)
      if (state.rangeFrom !== null && state.rangeTo !== null) {
        q = q.offset(state.rangeFrom).limit(state.rangeTo - state.rangeFrom + 1);
      }

      const rows = await q;

      // count total para a mesma query sem paginação
      let total = null;
      if (isCountOnly) {
        const countQ = knex(state.table)
          .modify((b) => _applyFilters(b, state.filters, knex))
          .count("* as cnt")
          .first();
        const countResult = await countQ;
        total = Number(countResult?.cnt ?? 0);
      }

      // maybeSingle / single
      if (state.isMaybeSingle) {
        return { data: rows?.[0] ?? null, error: null };
      }
      if (state.isSingle) {
        if (!rows || rows.length === 0) {
          return { data: null, error: { code: "PGRST116", message: "Not found" } };
        }
        return { data: rows[0], error: null };
      }

      return { data: rows ?? [], count: total, error: null };

    } catch (err) {
      return { data: null, error: err, count: null };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function _parseSelectCols(cols) {
    if (!cols || cols === "*") return ["*"];
    // Remove Supabase nested relation patterns like "users(id, nome, email, perfil)"
    // These span commas so a simple comma-split won't work — use regex to strip them.
    let cleaned = cols.replace(/\w+\([^)]*\)/g, "");
    // Clean up duplicate commas and leading/trailing commas left behind
    cleaned = cleaned.replace(/,\s*,/g, ",").replace(/^[\s,]+|[\s,]+$/g, "").trim();
    if (!cleaned) return ["*"];
    const result = cleaned.split(",").map((c) => c.trim()).filter(Boolean);
    return result.length > 0 ? result : ["*"];
  }

  function _applyFilters(q, filters, knex) {
    for (const f of filters) {
      switch (f.op) {
        case "eq":        q = q.where(f.col, f.val);            break;
        case "neq":       q = q.whereNot(f.col, f.val);         break;
        case "gt":        q = q.where(f.col, ">",  f.val);      break;
        case "gte":       q = q.where(f.col, ">=", f.val);      break;
        case "lt":        q = q.where(f.col, "<",  f.val);      break;
        case "lte":       q = q.where(f.col, "<=", f.val);      break;
        case "isNull":    q = q.whereNull(f.col);                break;
        case "isNotNull": q = q.whereNotNull(f.col);             break;
        case "in":        q = q.whereIn(f.col, f.vals ?? []);   break;
        case "ilike":     q = q.whereLike(f.col, f.val);        break;
        case "like":      q = q.where(f.col, "like", f.val);    break;
        case "not":
          if (f.subOp === "is") q = q.whereNotNull(f.col);
          break;
        case "or":
          // suporte básico: "campo.eq.valor,campo2.eq.valor2"
          if (f.conditionStr) {
            q = q.where(function () {
              const parts = f.conditionStr.split(",");
              for (const part of parts) {
                const m = part.match(/^(\w+)\.(eq|neq|gt|gte|lt|lte)\.(.+)$/);
                if (m) {
                  const [, col, op, val] = m;
                  const ops = { eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=" };
                  this.orWhere(col, ops[op] ?? "=", isNaN(val) ? val : Number(val));
                }
              }
            });
          }
          break;
      }
    }
    return q;
  }

  // ── Mock de storage (simples) ─────────────────────────────────────────────────
  const storageMock = {
    from: () => ({
      upload: jest.fn().mockResolvedValue({ data: { path: "test/file.jpg" }, error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: "http://test/file.jpg" } }),
      createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: "http://test/signed.jpg" }, error: null }),
      remove: jest.fn().mockResolvedValue({ data: {}, error: null }),
      list: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  };

  // ── Interface pública ─────────────────────────────────────────────────────────
  const mockClient = {
    from: (table) => buildQuery(table),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    storage: storageMock,
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: "Mock auth" } }),
      admin: {
        getUserById: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    },
  };

  // Exporta createUserClient também (usado no auth.js middleware)
  mockClient.createUserClient = jest.fn().mockReturnValue(mockClient);

  return mockClient;
}

module.exports = { createSupabaseMock };
