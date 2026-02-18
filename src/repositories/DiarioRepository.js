const BaseRepository = require("./BaseRepository");
const Diario = require("../models/Diario");

class DiarioRepository extends BaseRepository {
  constructor() {
    super(Diario);
  }

  async findBySyncId(syncId) {
    return await this.model.findOne({ syncId }).notDeleted();
  }

  async findByObra(obraId, options = {}) {
    return await this.findAll(
      { obra: obraId },
      {
        ...options,
        populate: ["responsavel", "fotos", "atividades.responsaveis"],
      },
    );
  }

  async findByData(obraId, data) {
    const iniciodia = new Date(data);
    iniciodia.setHours(0, 0, 0, 0);

    const fimDia = new Date(data);
    fimDia.setHours(23, 59, 59, 999);

    return await this.model
      .findOne({
        obra: obraId,
        data: {
          $gte: iniciodia,
          $lte: fimDia,
        },
      })
      .notDeleted()
      .populate(["responsavel", "fotos"]);
  }

  async findByPeriodo(obraId, dataInicio, dataFim, options = {}) {
    return await this.findAll(
      {
        obra: obraId,
        data: {
          $gte: dataInicio,
          $lte: dataFim,
        },
      },
      options,
    );
  }

  async findPendentes(options = {}) {
    return await this.findAll(
      { sincronizado: false },
      { ...options, populate: ["obra", "responsavel"] },
    );
  }

  async markAsSynced(diarioId) {
    return await this.model.findByIdAndUpdate(
      diarioId,
      { sincronizado: true, "metadata.updatedAt": new Date() },
      { new: true },
    );
  }

  async addOcorrencia(diarioId, ocorrencia) {
    const diario = await this.findById(diarioId);
    diario.ocorrencias.push(ocorrencia);
    await diario.save();
    return diario;
  }

  async addVisitante(diarioId, visitante) {
    const diario = await this.findById(diarioId);
    diario.visitantes.push(visitante);
    await diario.save();
    return diario;
  }
}

module.exports = new DiarioRepository();
