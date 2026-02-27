const medicaoRepository = require("../repositories/MedicaoRepository");
const diarioRepository = require("../repositories/DiarioRepository");
const solicitacaoCompraRepository = require("../repositories/SolicitacaoCompraRepository");
const arquivoRepository = require("../repositories/ArquivoRepository");
const { retryWithBackoff } = require("../utils/helpers");
const logger = require("../utils/logger");

class SyncService {
  _parseMetadata(metadata) {
    if (!metadata) return {};
    if (typeof metadata === "object") return metadata;
    if (typeof metadata === "string") {
      try {
        return JSON.parse(metadata);
      } catch (error) {
        return {};
      }
    }
    return {};
  }

  _recordUpdatedAt(record) {
    if (!record) return null;
    const metadata = this._parseMetadata(record.metadata);

    const candidates = [
      metadata.updatedAt,
      metadata.createdAt,
      record.updated_at,
      record.created_at,
      record.updatedAt,
      record.createdAt,
      record.dataAprovacao,
      record.dataSolicitacao,
    ];

    for (const value of candidates) {
      if (!value) continue;
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }

    return null;
  }

  _isClientNewer(clientTimestamp, record) {
    const clientTime = new Date(clientTimestamp);
    if (Number.isNaN(clientTime.getTime())) return false;

    const serverTime = this._recordUpdatedAt(record);
    if (!serverTime) return true;

    return clientTime > serverTime;
  }

  /**
   * Retorna dados pendentes de sincronização do servidor
   */
  async getPendingData(userId, lastSyncDate) {
    const lastSync = lastSyncDate ? new Date(lastSyncDate) : null;
    const hasValidLastSync = lastSync && !Number.isNaN(lastSync.getTime());

    const [medicoes, diarios, solicitacoes, arquivos] = await Promise.all([
      medicaoRepository.findAll({ responsavel: userId }, { limit: 1000 }),
      diarioRepository.findAll({ responsavel: userId }, { limit: 1000 }),
      solicitacaoCompraRepository.findAll({ solicitante: userId }, { limit: 1000 }),
      arquivoRepository.findAll({ uploadedBy: userId }, { limit: 1000 }),
    ]);

    const filterByDate = (rows) => {
      if (!hasValidLastSync) return rows;
      return rows.filter((row) => {
        const updatedAt = this._recordUpdatedAt(row);
        if (!updatedAt) return true;
        return updatedAt > lastSync;
      });
    };

    return {
      medicoes: filterByDate(medicoes.data),
      diarios: filterByDate(diarios.data),
      solicitacoes: filterByDate(solicitacoes.data),
      arquivos: filterByDate(arquivos.data),
      timestamp: new Date(),
    };
  }

  /**
   * Processa sincronização em lote (push do cliente)
   */
  async pushBatch(batchData, userId) {
    const results = {
      success: [],
      conflicts: [],
      errors: [],
    };

    // Processar medições
    if (batchData.medicoes && batchData.medicoes.length > 0) {
      for (const medicao of batchData.medicoes) {
        try {
          const result = await this.syncMedicao(medicao, userId);
          results.success.push({
            type: "medicao",
            id: result.id || result._id || null,
            syncId: medicao.syncId,
          });
        } catch (error) {
          if (error.isConflict) {
            results.conflicts.push({
              type: "medicao",
              syncId: medicao.syncId,
              error: error.message,
            });
          } else {
            results.errors.push({
              type: "medicao",
              syncId: medicao.syncId,
              error: error.message,
            });
          }
        }
      }
    }

    // Processar diários
    if (batchData.diarios && batchData.diarios.length > 0) {
      for (const diario of batchData.diarios) {
        try {
          const result = await this.syncDiario(diario, userId);
          results.success.push({
            type: "diario",
            id: result.id || result._id || null,
            syncId: diario.syncId,
          });
        } catch (error) {
          if (error.isConflict) {
            results.conflicts.push({
              type: "diario",
              syncId: diario.syncId,
              error: error.message,
            });
          } else {
            results.errors.push({
              type: "diario",
              syncId: diario.syncId,
              error: error.message,
            });
          }
        }
      }
    }

    // Processar solicitações
    if (batchData.solicitacoes && batchData.solicitacoes.length > 0) {
      for (const solicitacao of batchData.solicitacoes) {
        try {
          const result = await this.syncSolicitacao(solicitacao, userId);
          results.success.push({
            type: "solicitacao",
            id: result.id || result._id || null,
            syncId: solicitacao.syncId,
          });
        } catch (error) {
          if (error.isConflict) {
            results.conflicts.push({
              type: "solicitacao",
              syncId: solicitacao.syncId,
              error: error.message,
            });
          } else {
            results.errors.push({
              type: "solicitacao",
              syncId: solicitacao.syncId,
              error: error.message,
            });
          }
        }
      }
    }

    // Atualizar lastSync do usuário
    const userRepository = require("../repositories/UserRepository");
    await userRepository.updateLastSync(userId);

    return results;
  }

  /**
   * Sincroniza uma medição (Last-Write-Wins)
   */
  async syncMedicao(medicaoData, userId) {
    if (!medicaoData.syncId) {
      throw new Error("syncId é obrigatório para sincronização");
    }

    // Buscar medição existente pelo syncId
    const existing = await medicaoRepository.findBySyncId(medicaoData.syncId);

    if (existing) {
      // Resolver conflito usando Last-Write-Wins
      if (this._isClientNewer(medicaoData.clientTimestamp, existing)) {
        // Cliente mais recente, atualizar
        logger.info(
          `Resolvendo conflito de medição ${medicaoData.syncId} - Cliente vence`,
        );
        const existingId = existing.id || existing._id;
        const updated = await medicaoRepository.update(existingId, {
          ...medicaoData,
          sincronizado: true,
        });
        return updated;
      } else {
        // Servidor mais recente, retornar existente
        logger.info(
          `Resolvendo conflito de medição ${medicaoData.syncId} - Servidor vence`,
        );
        return existing;
      }
    }

    // Criar nova medição
    const medicaoService = require("./MedicaoService");
    return await medicaoService.create(
      {
        ...medicaoData,
        sincronizado: true,
      },
      userId,
    );
  }

  /**
   * Sincroniza um diário (Last-Write-Wins)
   */
  async syncDiario(diarioData, userId) {
    if (!diarioData.syncId) {
      throw new Error("syncId é obrigatório para sincronização");
    }

    const existing = await diarioRepository.findBySyncId(diarioData.syncId);

    if (existing) {
      if (this._isClientNewer(diarioData.clientTimestamp, existing)) {
        logger.info(
          `Resolvendo conflito de diário ${diarioData.syncId} - Cliente vence`,
        );
        const existingId = existing.id || existing._id;
        return await diarioRepository.update(existingId, {
          ...diarioData,
          sincronizado: true,
        });
      } else {
        logger.info(
          `Resolvendo conflito de diário ${diarioData.syncId} - Servidor vence`,
        );
        return existing;
      }
    }

    return await diarioRepository.create({
      ...diarioData,
      responsavel: userId,
      sincronizado: true,
      metadata: { createdBy: userId },
    });
  }

  /**
   * Sincroniza uma solicitação de compra
   */
  async syncSolicitacao(solicitacaoData, userId) {
    if (!solicitacaoData.syncId) {
      throw new Error("syncId é obrigatório para sincronização");
    }

    const existing = await solicitacaoCompraRepository.findBySyncId(
      solicitacaoData.syncId,
    );

    if (existing) {
      if (this._isClientNewer(solicitacaoData.clientTimestamp, existing)) {
        logger.info(
          `Resolvendo conflito de solicitação ${solicitacaoData.syncId} - Cliente vence`,
        );
        const existingId = existing.id || existing._id;
        return await solicitacaoCompraRepository.update(existingId, {
          ...solicitacaoData,
          sincronizado: true,
        });
      } else {
        logger.info(
          `Resolvendo conflito de solicitação ${solicitacaoData.syncId} - Servidor vence`,
        );
        return existing;
      }
    }

    return await solicitacaoCompraRepository.create({
      ...solicitacaoData,
      solicitante: userId,
      sincronizado: true,
      metadata: { createdBy: userId },
    });
  }

  /**
   * Retorna conflitos detectados
   */
  async getConflicts(userId, clientData) {
    const conflicts = [];

    // Verificar conflitos de medições
    for (const medicao of clientData.medicoes || []) {
      if (medicao.syncId) {
        const serverVersion = await medicaoRepository.findBySyncId(
          medicao.syncId,
        );
        if (serverVersion) {
          const clientTime = new Date(medicao.clientTimestamp);
          const serverTime = this._recordUpdatedAt(serverVersion);

          if (Number.isNaN(clientTime.getTime()) || !serverTime) {
            continue;
          }

          if (Math.abs(clientTime - serverTime) > 1000) {
            // Diferença > 1 segundo
            conflicts.push({
              type: "medicao",
              syncId: medicao.syncId,
              clientVersion: medicao,
              serverVersion,
              clientTimestamp: clientTime,
              serverTimestamp: serverTime,
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Retry de sincronização com backoff exponencial
   */
  async retrySync(syncFunction, maxAttempts = 3) {
    return await retryWithBackoff(
      syncFunction,
      maxAttempts,
      parseInt(process.env.SYNC_RETRY_DELAY) || 1000,
    );
  }
}

module.exports = new SyncService();
