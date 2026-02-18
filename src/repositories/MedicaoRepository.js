const BaseRepository = require("./BaseRepository");
const Medicao = require("../models/Medicao");

class MedicaoRepository extends BaseRepository {
  constructor() {
    super(Medicao);
  }

  async findBySyncId(syncId) {
    return await this.model.findOne({ syncId }).notDeleted();
  }

  async findByObra(obraId, options = {}) {
    return await this.findAll(
      { obra: obraId },
      { ...options, populate: ["responsavel", "anexos", "aprovadoPor"] },
    );
  }

  async findByResponsavel(userId, options = {}) {
    return await this.findAll(
      { responsavel: userId },
      { ...options, populate: ["obra", "anexos"] },
    );
  }

  async findPendentes(options = {}) {
    return await this.findAll(
      { sincronizado: false },
      { ...options, populate: ["obra", "responsavel"] },
    );
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

  async updateStatus(medicaoId, status, aprovadoPor = null) {
    const update = {
      status,
      "metadata.updatedAt": new Date(),
    };

    if (status === "aprovada" && aprovadoPor) {
      update.aprovadoPor = aprovadoPor;
      update.dataAprovacao = new Date();
    }

    return await this.model.findByIdAndUpdate(medicaoId, update, { new: true });
  }

  async markAsSynced(medicaoId) {
    return await this.model.findByIdAndUpdate(
      medicaoId,
      { sincronizado: true, "metadata.updatedAt": new Date() },
      { new: true },
    );
  }

  async getTotalPorObra(obraId) {
    const result = await this.model.aggregate([
      {
        $match: {
          obra: obraId,
          "metadata.deletedAt": null,
          status: "aprovada",
        },
      },
      {
        $unwind: "$itens",
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: { $multiply: ["$itens.quantidade", "$itens.valorUnitario"] },
          },
        },
      },
    ]);

    return result.length > 0 ? result[0].total : 0;
  }
}

module.exports = new MedicaoRepository();
