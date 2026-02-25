const medicaoRepository = require("../repositories/MedicaoRepository");
const diarioRepository = require("../repositories/DiarioRepository");
const solicitacaoCompraRepository = require("../repositories/SolicitacaoCompraRepository");
const arquivoRepository = require("../repositories/ArquivoRepository");
const { retryWithBackoff } = require("../utils/helpers");
const logger = require("../utils/logger");

class SyncService {
  /**
   * Retorna dados pendentes de sincronização do servidor
   */
  async getPendingData(userId, lastSyncDate) {
    const filter = {};

    if (lastSyncDate) {
      filter["metadata.updatedAt"] = { $gt: new Date(lastSyncDate) };
    }

    const [medicoes, diarios, solicitacoes, arquivos] = await Promise.all([
      medicaoRepository.findAll({ ...filter, responsavel: userId }),
      diarioRepository.findAll({ ...filter, responsavel: userId }),
      solicitacaoCompraRepository.findAll({ ...filter, solicitante: userId }),
      arquivoRepository.findAll({ ...filter, uploadedBy: userId }),
    ]);

    return {
      medicoes: medicoes.data,
      diarios: diarios.data,
      solicitacoes: solicitacoes.data,
      arquivos: arquivos.data,
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
      const clientTime = new Date(medicaoData.clientTimestamp);
      const serverTime = existing.metadata.updatedAt;

      if (clientTime > serverTime) {
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
      const clientTime = new Date(diarioData.clientTimestamp);
      const serverTime = existing.metadata.updatedAt;

      if (clientTime > serverTime) {
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
      const clientTime = new Date(solicitacaoData.clientTimestamp);
      const serverTime = existing.metadata.updatedAt;

      if (clientTime > serverTime) {
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
          const serverTime = serverVersion.metadata.updatedAt;

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
