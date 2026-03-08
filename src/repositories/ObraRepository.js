const BaseRepository = require("./BaseRepository");

class ObraRepository extends BaseRepository {
  constructor() {
    super("obras");
  }

  async findByCodigo(codigo) {
    await this._ensureTable();
    const qb = this.knex(this.table).where({ codigo });
    await this._applyNotDeleted(qb);
    return await qb.first();
  }

  async findBySyncId(syncId) {
    return await this.findOne({ syncId });
  }

  async findByResponsavel(userId, options = {}) {
    return await this.findAll({ responsavel: userId }, options);
  }

  // ── N:N encarregado ──────────────────────────────────────────────────────

  /**
   * Retorna as obras às quais userId está vinculado como encarregado
   * usando a tabela obra_encarregados.
   */
  async findByEncarregado(userId, options = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;
    const hasTable = await this.knex.schema.hasTable("obra_encarregados");

    if (hasTable) {
      let qb = this.knex("obras")
        .join("obra_encarregados", "obras.id", "obra_encarregados.obraId")
        .where("obra_encarregados.userId", userId)
        .whereRaw("(json_extract(obras.metadata, '$.deletedAt') IS NULL OR obras.metadata NOT LIKE '%\"deletedAt\":%')");

      if (status) qb = qb.andWhere("obras.status", status);

      const countQb = qb.clone().count({ count: "*" });
      const totalRes = await countQb.first();
      const total = totalRes ? Number(totalRes.count || totalRes["count(*)"] || 0) : 0;

      if (total > 0) {
        const data = await qb.select("obras.*").limit(limit).offset(offset);
        return { data, total, page, limit };
      }
    }

    // Fallback: usar obraAtual do registro do usuário
    const user = await this.knex("users").where({ id: userId }).first();
    if (!user || !user.obraAtual) {
      return { data: [], total: 0, page, limit };
    }

    let qbFallback = this.knex("obras")
      .where("obras.id", user.obraAtual)
      .whereRaw("(json_extract(obras.metadata, '$.deletedAt') IS NULL OR obras.metadata NOT LIKE '%\"deletedAt\":%')");

    if (status) qbFallback = qbFallback.andWhere("obras.status", status);

    const data = await qbFallback.select("obras.*").limit(limit).offset(offset);
    return { data, total: data.length, page, limit };
  }

  /**
   * Verifica se um usuário está vinculado a uma obra.
   */
  async isEncarregadoVinculado(obraId, userId) {
    const hasTable = await this.knex.schema.hasTable("obra_encarregados");
    if (hasTable) {
      const row = await this.knex("obra_encarregados")
        .where({ obraId, userId })
        .first();
      if (row) return true;
    }
    // Fallback: verificar obraAtual do usuário
    const user = await this.knex("users").where({ id: userId, obraAtual: obraId }).first();
    return Boolean(user);
  }

  /**
   * Vincula um encarregado a uma obra (N:N).
   */
  async vincularEncarregado(obraId, userId, funcao = "encarregado") {
    const hasTable = await this.knex.schema.hasTable("obra_encarregados");
    if (!hasTable) throw new Error("Tabela obra_encarregados não existe. Execute as migrations.");

    const jaExiste = await this.knex("obra_encarregados")
      .where({ obraId, userId })
      .first();
    if (!jaExiste) {
      await this.knex("obra_encarregados").insert({
        obraId,
        userId,
        funcao,
        dataInclusao: new Date(),
      });
    }
    return await this.findById(obraId);
  }

  /**
   * Desvincula um encarregado de uma obra.
   */
  async desvincularEncarregado(obraId, userId) {
    const hasTable = await this.knex.schema.hasTable("obra_encarregados");
    if (!hasTable) return;
    await this.knex("obra_encarregados").where({ obraId, userId }).delete();
    return await this.findById(obraId);
  }

  /**
   * Lista os encarregados vinculados a uma obra.
   */
  async listarEncarregados(obraId) {
    const hasTable = await this.knex.schema.hasTable("obra_encarregados");
    if (!hasTable) return [];
    return await this.knex("obra_encarregados")
      .join("users", "obra_encarregados.userId", "users.id")
      .where("obra_encarregados.obraId", obraId)
      .select(
        "users.id",
        "users.nome",
        "users.email",
        "users.perfil",
        "obra_encarregados.funcao",
        "obra_encarregados.dataInclusao",
      );
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  async findByEquipeMembro(userId, options = {}) {
    // equipe stored as JSON: filter client-side (legado)
    const all = await this.findAll({}, { ...options, limit: 10000 });
    const data = all.data.filter((o) => {
      try {
        const equipe = o.equipe ? JSON.parse(o.equipe) : [];
        return equipe.some((m) => String(m.usuario) === String(userId));
      } catch (err) {
        return false;
      }
    });
    return { data, total: data.length, page: 1, limit: data.length };
  }

  async addMembroEquipe(obraId, userId, funcao) {
    const obra = await this.findById(obraId);
    let equipe = [];
    try {
      equipe = obra.equipe ? JSON.parse(obra.equipe) : [];
    } catch (err) {
      equipe = [];
    }

    const jaExiste = equipe.some((m) => String(m.usuario) === String(userId));
    if (!jaExiste) {
      equipe.push({ usuario: userId, funcao, dataInclusao: new Date() });
      await this.update(obraId, { equipe: JSON.stringify(equipe) });
    }

    return await this.findById(obraId);
  }

  async removeMembroEquipe(obraId, userId) {
    const obra = await this.findById(obraId);
    let equipe = [];
    try {
      equipe = obra.equipe ? JSON.parse(obra.equipe) : [];
    } catch (err) {
      equipe = [];
    }

    equipe = equipe.filter((m) => String(m.usuario) !== String(userId));
    await this.update(obraId, { equipe: JSON.stringify(equipe) });
    return await this.findById(obraId);
  }

  async updateStatus(obraId, status) {
    return await this.update(obraId, { status });
  }

  async updateOrcamento(obraId, valorGasto) {
    const obra = await this.findById(obraId);
    let orcamento = {};
    try {
      orcamento = obra.orcamento ? JSON.parse(obra.orcamento) : {};
    } catch (err) {
      orcamento = {};
    }
    orcamento.valorGasto = (orcamento.valorGasto || 0) + valorGasto;
    await this.update(obraId, { orcamento: JSON.stringify(orcamento) });
    return await this.findById(obraId);
  }

  async getObrasPorStatus(status, options = {}) {
    return await this.findAll({ status }, options);
  }
}

module.exports = new ObraRepository();
