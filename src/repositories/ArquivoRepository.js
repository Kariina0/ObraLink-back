const BaseRepository = require("./BaseRepository");
const fs = require("fs").promises;

class ArquivoRepository extends BaseRepository {
  constructor() {
    super("arquivos");
  }

  async findBySyncId(syncId) {
    return this.findOne({ syncId });
  }

  async findByObra(obraId, options = {}) {
    return this.findAll({ obra: obraId }, options);
  }

  async findByTipo(tipo, options = {}) {
    return this.findAll({ tipo }, options);
  }

  async findByUploader(userId, options = {}) {
    return this.findAll({ uploadedBy: userId }, options);
  }

  async findByIds(ids = []) {
    const uniqueIds = [
      ...new Set((ids || []).map(Number).filter(Number.isInteger)),
    ];
    if (uniqueIds.length === 0) return [];

    const { data, error } = await this._runWithDeletedAtFallback(
      (withDeletedAt) => {
        let query = this.supabase
          .from(this.table)
          .select("*")
          .in("id", uniqueIds);
        if (withDeletedAt) {
          query = query.is("deletedAt", null);
        }
        return query;
      },
    );

    if (error) throw error;

    const byId = new Map(
      (data ?? []).map((arquivo) => [Number(arquivo.id), arquivo]),
    );
    return uniqueIds.map((id) => byId.get(id)).filter(Boolean);
  }

  async findPendentes(options = {}) {
    return this.findAll({ sincronizado: false }, options);
  }

  async markAsSynced(arquivoId) {
    return this.update(arquivoId, { sincronizado: true });
  }

  /**
   * Soft-deleta o registro no banco e remove o arquivo físico local (se existir).
   * Soft-delete no banco PRIMEIRO — se falhar, nada é perdido no storage.
   * C-4: atomicidade garantida pela ordem das operações.
   */
  async deleteWithFile(id) {
    const arquivo = await this.findById(id);

    // Soft-delete no banco primeiro
    const result = await this.delete(id);

    // Arquivo físico local: remoção após confirmação do banco
    if (arquivo?.caminho) {
      try {
        await fs.unlink(arquivo.caminho);
      } catch (error) {
        const logger = require("../utils/logger");
        logger.error("Erro ao excluir arquivo físico:", error.message);
      }
    }

    return result;
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

  /**
   * Retorna uso de storage (soma de tamanhos e contagem) por obra.
   * Usa RPC get_storage_usage definida em supabase_rls_auth.sql.
   */
  async getStorageUsage(obraId = null) {
    const { data, error } = await this.supabase.rpc("get_storage_usage", {
      p_obra_id: obraId ? Number(obraId) : null,
    });
    if (error) throw error;

    const rows = data ?? [];
    const totalSize = rows.reduce(
      (acc, r) => acc + Number(r.total_bytes ?? 0),
      0,
    );
    const totalFiles = rows.reduce(
      (acc, r) => acc + Number(r.total_arquivos ?? 0),
      0,
    );
    return { totalSize, totalFiles };
  }
}

module.exports = new ArquivoRepository();
