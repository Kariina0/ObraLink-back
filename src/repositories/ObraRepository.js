const BaseRepository = require("./BaseRepository");
const Obra = require("../models/Obra");

class ObraRepository extends BaseRepository {
  constructor() {
    super(Obra);
  }

  async findByCodigo(codigo) {
    return await this.model
      .findOne({ codigo })
      .notDeleted()
      .populate("responsavel equipe.usuario");
  }

  async findBySyncId(syncId) {
    return await this.model.findOne({ syncId }).notDeleted();
  }

  async findByResponsavel(userId, options = {}) {
    return await this.findAll({ responsavel: userId }, options);
  }

  async findByEquipeMembro(userId, options = {}) {
    return await this.findAll({ "equipe.usuario": userId }, options);
  }

  async addMembroEquipe(obraId, userId, funcao) {
    const obra = await this.findById(obraId);

    // Verificar se já está na equipe
    const jaExiste = obra.equipe.some(
      (membro) => membro.usuario.toString() === userId.toString(),
    );

    if (!jaExiste) {
      obra.equipe.push({
        usuario: userId,
        funcao,
        dataInclusao: new Date(),
      });
      await obra.save();
    }

    return obra;
  }

  async removeMembroEquipe(obraId, userId) {
    const obra = await this.findById(obraId);

    obra.equipe = obra.equipe.filter(
      (membro) => membro.usuario.toString() !== userId.toString(),
    );

    await obra.save();
    return obra;
  }

  async updateStatus(obraId, status) {
    return await this.update(obraId, { status });
  }

  async updateOrcamento(obraId, valorGasto) {
    const obra = await this.findById(obraId);
    obra.orcamento.valorGasto = (obra.orcamento.valorGasto || 0) + valorGasto;
    await obra.save();
    return obra;
  }

  async getObrasPorStatus(status, options = {}) {
    return await this.findAll({ status }, options);
  }
}

module.exports = new ObraRepository();
