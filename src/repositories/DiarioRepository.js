const BaseRepository = require("./BaseRepository");

class DiarioRepository extends BaseRepository {
  constructor() {
    super("diarios");
  }

  async findBySyncId(syncId) {
    return await this.findOne({ syncId });
  }

  async findByObra(obraId, options = {}) {
    return await this.findAll({ obra: obraId }, options);
  }

  async findByData(obraId, data) {
    await this._ensureTable();
    const iniciodia = new Date(data);
    iniciodia.setHours(0, 0, 0, 0);
    const fimDia = new Date(data);
    fimDia.setHours(23, 59, 59, 999);

    const qb = this.knex(this.table)
      .where({ obra: obraId })
      .andWhere("data", ">=", iniciodia.toISOString())
      .andWhere("data", "<=", fimDia.toISOString());
    await this._applyNotDeleted(qb);
    return (await qb.first()) || null;
  }

  async findByPeriodo(obraId, dataInicio, dataFim, options = {}) {
    await this._ensureTable();
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;
    const inicio = new Date(dataInicio).toISOString();
    const fim = new Date(dataFim).toISOString();

    const countQb = this.knex(this.table)
      .where({ obra: obraId })
      .andWhere("data", ">=", inicio)
      .andWhere("data", "<=", fim)
      .count({ count: "*" });
    await this._applyNotDeleted(countQb);
    const totalRes = await countQb.first();
    const total = totalRes ? Number(totalRes.count || 0) : 0;

    const dataQb = this.knex(this.table)
      .where({ obra: obraId })
      .andWhere("data", ">=", inicio)
      .andWhere("data", "<=", fim)
      .orderBy("data", "asc")
      .limit(limit)
      .offset(offset);
    await this._applyNotDeleted(dataQb);
    const rows = await dataQb;
    return { data: rows, total, page, limit };
  }

  async findPendentes(options = {}) {
    return await this.findAll({ sincronizado: false }, options);
  }

  async markAsSynced(diarioId) {
    return await this.update(diarioId, { sincronizado: true });
  }

  async addOcorrencia(diarioId, ocorrencia) {
    const diario = await this.findById(diarioId);
    let ocorrencias = [];
    try {
      ocorrencias = diario.ocorrencias ? JSON.parse(diario.ocorrencias) : [];
    } catch (err) {
      ocorrencias = [];
    }
    ocorrencias.push(ocorrencia);
    await this.update(diarioId, { ocorrencias: JSON.stringify(ocorrencias) });
    return await this.findById(diarioId);
  }

  async addVisitante(diarioId, visitante) {
    const diario = await this.findById(diarioId);
    let visitantes = [];
    try {
      visitantes = diario.visitantes ? JSON.parse(diario.visitantes) : [];
    } catch (err) {
      visitantes = [];
    }
    visitantes.push(visitante);
    await this.update(diarioId, { visitantes: JSON.stringify(visitantes) });
    return await this.findById(diarioId);
  }
}

module.exports = new DiarioRepository();
