const BaseRepository = require("./BaseRepository");
const Arquivo = require("../models/Arquivo");
const fs = require("fs").promises;
const path = require("path");

class ArquivoRepository extends BaseRepository {
  constructor() {
    super(Arquivo);
  }

  async findBySyncId(syncId) {
    return await this.model.findOne({ syncId }).notDeleted();
  }

  async findByObra(obraId, options = {}) {
    return await this.findAll(
      { obra: obraId },
      { ...options, populate: ["uploadedBy"] },
    );
  }

  async findByTipo(tipo, options = {}) {
    return await this.findAll({ tipo }, options);
  }

  async findByUploader(userId, options = {}) {
    return await this.findAll({ uploadedBy: userId }, options);
  }

  async findPendentes(options = {}) {
    return await this.findAll(
      { sincronizado: false },
      { ...options, populate: ["obra", "uploadedBy"] },
    );
  }

  async markAsSynced(arquivoId) {
    return await this.model.findByIdAndUpdate(
      arquivoId,
      { sincronizado: true, "metadata.updatedAt": new Date() },
      { new: true },
    );
  }

  async deleteWithFile(id) {
    const arquivo = await this.findById(id);

    // Excluir arquivo físico
    try {
      await fs.unlink(arquivo.caminho);
    } catch (error) {
      console.error("Erro ao excluir arquivo físico:", error);
    }

    // Excluir do banco (soft delete)
    return await this.delete(id);
  }

  async deleteMultipleWithFiles(ids) {
    const results = [];

    for (const id of ids) {
      try {
        const result = await this.deleteWithFile(id);
        results.push({ id, success: true, result });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }

    return results;
  }

  async getStorageUsage(obraId = null) {
    const filter = obraId
      ? { obra: obraId, "metadata.deletedAt": null }
      : { "metadata.deletedAt": null };

    const result = await this.model.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSize: { $sum: "$tamanho" },
          totalFiles: { $sum: 1 },
        },
      },
    ]);

    return result.length > 0 ? result[0] : { totalSize: 0, totalFiles: 0 };
  }
}

module.exports = new ArquivoRepository();
