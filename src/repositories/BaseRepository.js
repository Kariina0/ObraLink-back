const { NotFoundError } = require("../utils/errors");
const database = require("../config/database");

/**
 * BaseRepository usando Knex (SQLite). Aceita tanto um modelo Mongoose
 * (para compatibilidade) quanto uma string com o nome da tabela.
 */
class BaseRepository {
  constructor(modelOrTable) {
    this.modelOrTable = modelOrTable;
    this.table = typeof modelOrTable === "string" ? modelOrTable : (modelOrTable && modelOrTable.collection ? modelOrTable.collection.name : null);
    // Keep reference to original model for backward compatibility (many repos still use this.model)
    this.model = modelOrTable && modelOrTable.collection ? modelOrTable : null;
    this._hasDeletedColumn = {};
    this._hasMetadataColumnCache = {};
  }

  get knex() {
    return database.knex;
  }

  async _ensureTable() {
    if (!this.table) throw new Error("Table name not defined for repository");
  }

  async _hasMetadataDeletedColumn() {
    if (this._hasDeletedColumn[this.table] !== undefined) return this._hasDeletedColumn[this.table];
    try {
      const exists = await this.knex.schema.hasColumn(this.table, "metadata_deletedAt");
      this._hasDeletedColumn[this.table] = exists;
      return exists;
    } catch (err) {
      this._hasDeletedColumn[this.table] = false;
      return false;
    }
  }

  async _hasMetadataColumn() {
    if (this._hasMetadataColumnCache[this.table] !== undefined) return this._hasMetadataColumnCache[this.table];
    try {
      const exists = await this.knex.schema.hasColumn(this.table, "metadata");
      this._hasMetadataColumnCache[this.table] = exists;
      return exists;
    } catch (err) {
      this._hasMetadataColumnCache[this.table] = false;
      return false;
    }
  }

  _isSqlite() {
    try {
      const client = this.knex.client.config.client;
      return client === "sqlite3" || client === "better-sqlite3";
    } catch {
      return false;
    }
  }

  /** Returns a raw SQL fragment for filtering out soft-deleted rows via metadata JSON. */
  _notDeletedCondition(tablePrefix = null) {
    const col = tablePrefix ? `${tablePrefix}.metadata` : "metadata";
    if (this._isSqlite()) {
      return `(${col} IS NULL OR json_extract(${col}, '$.deletedAt') IS NULL)`;
    }
    return `(${col} IS NULL OR (${col}::jsonb)->>'deletedAt' IS NULL)`;
  }

  _applyNotDeleted(queryBuilder) {
    // Prefer explicit metadata_deletedAt column if present
    return (async () => {
      const hasMetadataCol = await this._hasMetadataColumn();
      const hasCol = await this._hasMetadataDeletedColumn();
      if (!hasMetadataCol && !hasCol) return queryBuilder;
      if (hasCol) {
        return queryBuilder.whereNull(`${this.table}.metadata_deletedAt`);
      }

      // Fallback: use client-appropriate JSON syntax
      if (this._isSqlite()) {
        return queryBuilder.whereRaw("(metadata IS NULL OR json_extract(metadata, '$.deletedAt') IS NULL)");
      }
      // PostgreSQL JSONB
      return queryBuilder.whereRaw("(metadata IS NULL OR (metadata::jsonb)->>'deletedAt' IS NULL)");
    })();
  }

  async findById(id) {
    await this._ensureTable();
    const qb = this.knex(this.table).where({ id });
    await this._applyNotDeleted(qb);
    const row = await qb.first();
    if (!row) throw new NotFoundError("Registro não encontrado");
    return row;
  }

  async findOne(filter = {}) {
    await this._ensureTable();
    const qb = this.knex(this.table).where(filter);
    await this._applyNotDeleted(qb);
    const row = await qb.first();
    return row || null;
  }

  _parseSort(sort) {
    if (!sort) return null;
    if (typeof sort === "string") return sort;
    if (typeof sort === "object") {
      const key = Object.keys(sort)[0];
      const dir = sort[key] === -1 ? "desc" : "asc";
      return { key, dir };
    }
    return null;
  }

  async findAll(filter = {}, options = {}) {
    await this._ensureTable();
    const {
      page = 1,
      limit = 10,
      sort = { "metadata.createdAt": -1 },
    } = options;

    const offset = (page - 1) * limit;

    const qb = this.knex(this.table).where(filter);
    await this._applyNotDeleted(qb);

    const parsed = this._parseSort(sort);
    if (parsed) {
      if (typeof parsed === "string") {
        qb.orderBy(parsed);
      } else {
        // support json fields like 'metadata.createdAt'
        if (parsed.key && parsed.key.includes(".")) {
          const parts = parsed.key.split(".");
          // special-case metadata.* with client-appropriate JSON operator
          if (parts[0] === "metadata") {
            const jsonKey = parts.slice(1).join(".");
            if (this._isSqlite()) {
              qb.orderByRaw(`json_extract(metadata, '$.${jsonKey}') ${parsed.dir}`);
            } else {
              qb.orderByRaw(`(metadata::jsonb)->>'${jsonKey}' ${parsed.dir}`);
            }
          } else {
            // fallback to raw ordering for other dotted keys
            qb.orderByRaw(`${parsed.key} ${parsed.dir}`);
          }
        } else {
          qb.orderBy(parsed.key, parsed.dir);
        }
      }
    }

    const data = await qb.limit(limit).offset(offset);

    // total count
    const countQb = this.knex(this.table).count({ count: '*' }).where(filter);
    await this._applyNotDeleted(countQb);
    const totalRes = await countQb.first();
    const total = totalRes ? Number(totalRes.count || totalRes['count(*)'] || 0) : 0;

    return { data, total, page, limit };
  }

  async create(data) {
    await this._ensureTable();
    // prepare row and filter to existing columns
    const row = { ...data };
    const colsInfo = await this.knex(this.table).columnInfo();
    const allowed = Object.keys(colsInfo || {});

    // handle metadata only if column exists
    if (allowed.includes("metadata")) {
      if (!row.metadata) row.metadata = { createdAt: new Date() };
      else row.metadata = { ...(typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata), createdAt: row.metadata.createdAt || new Date() };
      row.metadata = JSON.stringify(row.metadata);
    } else {
      // ensure we don't try to insert metadata into tables without it
      delete row.metadata;
    }

    // filter out unknown columns to avoid SQLITE_ERROR for extra fields
    const insertRow = Object.fromEntries(Object.entries(row).filter(([k]) => allowed.includes(k)));

    const inserted = await this.knex(this.table).insert(insertRow).returning("id");
    // PostgreSQL returns [{ id: N }], SQLite returns [N]
    const raw = Array.isArray(inserted) ? inserted[0] : inserted;
    const id = typeof raw === "object" && raw !== null ? raw.id : raw;
    return this.findById(id);
  }

  async update(id, data) {
    await this._ensureTable();
    const existing = await this.knex(this.table).where({ id }).first();
    if (!existing) throw new NotFoundError("Registro não encontrado");

    // prepare update filtering to table columns and merge metadata if present
    const colsInfo = await this.knex(this.table).columnInfo();
    const allowed = Object.keys(colsInfo || {});

    let metadata = {};
    if (allowed.includes('metadata')) {
      try {
        metadata = existing.metadata ? JSON.parse(existing.metadata) : {};
      } catch (err) {
        metadata = {};
      }
      metadata.updatedAt = new Date();
    }

    const row = { ...data };
    if (allowed.includes('metadata')) {
      const incoming = row.metadata && typeof row.metadata !== 'string' ? row.metadata : (row.metadata ? JSON.parse(row.metadata) : {});
      row.metadata = JSON.stringify({ ...metadata, ...incoming });
    } else {
      delete row.metadata;
    }

    const updateRow = Object.fromEntries(Object.entries(row).filter(([k]) => allowed.includes(k)));

    await this.knex(this.table).where({ id }).update(updateRow);
    return this.findById(id);
  }

  async delete(id, soft = true) {
    await this._ensureTable();
    const existing = await this.knex(this.table).where({ id }).first();
    if (!existing) throw new NotFoundError("Registro não encontrado");

    if (soft) {
      // update metadata.deletedAt or metadata_deletedAt if exists
      const hasCol = await this._hasMetadataDeletedColumn();
      if (hasCol) {
        await this.knex(this.table).where({ id }).update({ metadata_deletedAt: new Date() });
        return this.findById(id).catch(() => null);
      }

      const hasMetadata = await this._hasMetadataColumn();
      if (hasMetadata) {
        let metadata;
        try {
          metadata = existing.metadata ? JSON.parse(existing.metadata) : {};
        } catch (err) {
          metadata = {};
        }
        metadata.deletedAt = new Date();
        await this.knex(this.table).where({ id }).update({ metadata: JSON.stringify(metadata) });
        return this.findById(id).catch(() => null);
      }

      // No metadata support, fall back to hard delete
    }

    // hard delete
    await this.knex(this.table).where({ id }).del();
    return true;
  }

  async exists(filter) {
    await this._ensureTable();
    const qb = this.knex(this.table).where(filter).count({ count: '*' });
    await this._applyNotDeleted(qb);
    const res = await qb.first();
    const c = res ? Number(res.count || res['count(*)'] || 0) : 0;
    return c > 0;
  }

  async count(filter = {}) {
    await this._ensureTable();
    const qb = this.knex(this.table).where(filter).count({ count: '*' });
    await this._applyNotDeleted(qb);
    const res = await qb.first();
    return res ? Number(res.count || res['count(*)'] || 0) : 0;
  }
}

module.exports = BaseRepository;
