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
    const iniciodia = new Date(data);
    iniciodia.setHours(0, 0, 0, 0);

    const fimDia = new Date(data);
    fimDia.setHours(23, 59, 59, 999);

    const all = await this.findAll({ obra: obraId }, { limit: 10000 });
    const found = all.data.find((d) => {
      const dt = d.data ? new Date(d.data) : null;
      if (!dt) return false;
      return dt >= iniciodia && dt <= fimDia;
    });
    return found || null;
  }

  async findByPeriodo(obraId, dataInicio, dataFim, options = {}) {
    const all = await this.findAll({ obra: obraId }, { ...options, limit: 10000 });
    const data = all.data.filter((d) => {
      const dt = d.data ? new Date(d.data) : null;
      if (!dt) return false;
      return dt >= new Date(dataInicio) && dt <= new Date(dataFim);
    });
    return { data, total: data.length, page: 1, limit: data.length };
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
