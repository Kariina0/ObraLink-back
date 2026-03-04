const BaseRepository = require("./BaseRepository");

class MedicaoRepository extends BaseRepository {
  constructor() {
    super("medicoes");
  }

  async findBySyncId(syncId) {
    return await this.findOne({ syncId });
  }

  async findByObra(obraId, options = {}) {
    return await this.findAll({ obra: obraId }, options);
  }

  async findByResponsavel(userId, options = {}) {
    return await this.findAll({ responsavel: userId }, options);
  }

  /**
   * Busca medições de um responsável com filtros opcionais.
   * Suporta: obra, status, tipoServico, area, dataInicio, dataFim.
   * Usado pelo endpoint GET /api/measurements/minhas com query params de filtro.
   */
  async findByResponsavelFiltered(userId, filters = {}, options = {}) {
    // Reutiliza findAllFiltered passando responsavel fixo
    return await this.findAllFiltered(
      { ...filters, responsavel: userId },
      options,
    );
  }

  async findPendentes(options = {}) {
    return await this.findAll({ sincronizado: false }, options);
  }

  /**
   * Busca com filtros opcionais: obra, responsavel, status, dataInicio, dataFim.
   * Faz JOIN com obras e users para retornar nomes legíveis.
   * Funciona via query params no back-end.
   */
  async findAllFiltered(filters = {}, options = {}) {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    let qb = this.knex("medicoes")
      // JOIN opcional com obras para obter o nome da obra
      .leftJoin("obras", "medicoes.obra", "obras.id")
      // JOIN opcional com users para obter o nome do responsável
      .leftJoin("users", "medicoes.responsavel", "users.id")
      .whereRaw(
        "(json_extract(medicoes.metadata, '$.deletedAt') IS NULL OR medicoes.metadata NOT LIKE '%\"deletedAt\":%')"
      );

    if (filters.obra) qb = qb.andWhere("medicoes.obra", Number(filters.obra));
    if (filters.responsavel) qb = qb.andWhere("medicoes.responsavel", Number(filters.responsavel));
    if (filters.status) qb = qb.andWhere("medicoes.status", filters.status);
    if (filters.area) qb = qb.andWhere("medicoes.area", filters.area);
    if (filters.tipoServico) qb = qb.andWhere("medicoes.tipoServico", filters.tipoServico);

    if (filters.dataInicio) {
      qb = qb.andWhere("medicoes.data", ">=", new Date(filters.dataInicio).toISOString());
    }
    if (filters.dataFim) {
      qb = qb.andWhere("medicoes.data", "<=", new Date(filters.dataFim).toISOString());
    }

    const countQb = qb.clone().count({ count: "*" });
    const totalRes = await countQb.first();
    const total = totalRes ? Number(totalRes.count || totalRes["count(*)"] || 0) : 0;

    const data = await qb
      .select(
        "medicoes.*",
        // Campos enriquecidos: nome da obra e do responsável para exibição nos relatórios
        "obras.nome as obraNome",
        "users.nome as responsavelNome",
      )
      .orderBy("medicoes.created_at", "desc")
      .limit(limit)
      .offset(offset);

    return { data, total, page, limit };
  }

  async findByPeriodo(obraId, dataInicio, dataFim, options = {}) {
    return await this.findAllFiltered(
      { obra: obraId, dataInicio, dataFim },
      options,
    );
  }

  async updateStatus(medicaoId, status, aprovadoPor = null) {
    const update = { status };
    if (status === "aprovada" && aprovadoPor) {
      update.aprovadoPor = aprovadoPor;
      update.dataAprovacao = new Date();
    }
    return await this.update(medicaoId, update);
  }

  async markAsSynced(medicaoId) {
    return await this.update(medicaoId, { sincronizado: true });
  }

  async getTotalPorObra(obraId) {
    // Load medicoes aprovadas for obra and sum items on application side
    const rows = await this.knex("medicoes")
      .where({ obra: obraId, status: "aprovada" })
      .andWhereRaw(
        `json_extract(metadata, '$.deletedAt') IS NULL OR metadata NOT LIKE '%"deletedAt":%'`
      );
    let total = 0;
    for (const r of rows) {
      try {
        const itens = r.itens ? JSON.parse(r.itens) : [];
        for (const it of itens) {
          const q = Number(it.quantidade || 0);
          const v = Number(it.valorUnitario || 0);
          total += q * v;
        }
      } catch (err) {
        continue;
      }
    }
    return total;
  }
}

module.exports = new MedicaoRepository();

