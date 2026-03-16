const BaseRepository = require("./BaseRepository");
const fs = require("fs").promises;
const path = require("path");

class ArquivoRepository extends BaseRepository {
  constructor() {
    super("arquivos");
  }

  async findBySyncId(syncId) {
    return await this.findOne({ syncId });
  }

  async findByObra(obraId, options = {}) {
    return await this.findAll({ obra: obraId }, options);
  }

  async findByTipo(tipo, options = {}) {
    return await this.findAll({ tipo }, options);
  }

  async findByUploader(userId, options = {}) {
    return await this.findAll({ uploadedBy: userId }, options);
  }

  async findPendentes(options = {}) {
    return await this.findAll({ sincronizado: false }, options);
  }

  async markAsSynced(arquivoId) {
    return await this.update(arquivoId, { sincronizado: true });
  }

  async deleteWithFile(id) {
    const arquivo = await this.findById(id);

    // Excluir arquivo físico
    try {
      if (arquivo && arquivo.caminho) await fs.unlink(arquivo.caminho);
    } catch (error) {
      const logger = require("../utils/logger");
      logger.error("Erro ao excluir arquivo físico:", error);
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
    const qb = this.knex(this.table);
    if (obraId) qb.where({ obra: obraId });
    qb.andWhereRaw("(metadata IS NULL OR (metadata::jsonb)->>'deletedAt' IS NULL)");
    const rows = await qb.select('tamanho');
    let totalSize = 0;
    for (const r of rows) totalSize += Number(r.tamanho || 0);
    return { totalSize, totalFiles: rows.length };
  }
}

module.exports = new ArquivoRepository();
