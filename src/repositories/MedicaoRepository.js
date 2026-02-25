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

  async findPendentes(options = {}) {
    return await this.findAll({ sincronizado: false }, options);
  }

  async findByPeriodo(obraId, dataInicio, dataFim, options = {}) {
    // data stored as ISO strings in 'data' column
    const filter = { obra: obraId };
    const all = await this.findAll(filter, { ...options, limit: 10000 });
    const data = all.data.filter((m) => {
      const d = m.data ? new Date(m.data) : null;
      if (!d) return false;
      return d >= new Date(dataInicio) && d <= new Date(dataFim);
    });
    return { data, total: data.length, page: 1, limit: data.length };
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
        .andWhereRaw(`json_extract(metadata, '$.deletedAt') IS NULL OR metadata NOT LIKE '%"deletedAt":%'`);
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
