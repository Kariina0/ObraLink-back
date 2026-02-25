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

  async findByEquipeMembro(userId, options = {}) {
    // equipe stored as JSON: filter client-side
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
