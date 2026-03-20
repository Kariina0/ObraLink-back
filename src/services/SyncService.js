const medicaoRepository = require("../repositories/MedicaoRepository");
const diarioRepository = require("../repositories/DiarioRepository");
const solicitacaoCompraRepository = require("../repositories/SolicitacaoCompraRepository");
const arquivoRepository = require("../repositories/ArquivoRepository");
const { sleep } = require("../utils/helpers");
const logger = require("../utils/logger");
const { ValidationError } = require("../utils/errors");

// Import lazy para evitar dependência circular (ArquivoService → SyncService)
const _getArquivoService = () => require("./ArquivoService");

/** Status finais que não podem ser sobrescritos por um sync posterior */
const FINAL_STATUSES = ["aprovada", "rejeitada", "concluida"];

class SyncService {
  _extractRetryableBatch(previousBatch, errors) {
    const errorSyncIdsByType = {
      medicao: new Set(),
      diario: new Set(),
      solicitacao: new Set(),
      arquivo: new Set(),
    };

    for (const item of errors || []) {
      if (!item?.type || !item?.syncId) continue;
      if (errorSyncIdsByType[item.type]) {
        errorSyncIdsByType[item.type].add(item.syncId);
      }
    }

    return {
      medicoes: (previousBatch.medicoes || []).filter((item) =>
        errorSyncIdsByType.medicao.has(item.syncId),
      ),
      diarios: (previousBatch.diarios || []).filter((item) =>
        errorSyncIdsByType.diario.has(item.syncId),
      ),
      solicitacoes: (previousBatch.solicitacoes || []).filter((item) =>
        errorSyncIdsByType.solicitacao.has(item.syncId),
      ),
      arquivos: (previousBatch.arquivos || []).filter((item) =>
        errorSyncIdsByType.arquivo.has(item.syncId),
      ),
    };
  }

  _isBatchEmpty(batch = {}) {
    return (
      (batch.medicoes || []).length === 0
      && (batch.diarios || []).length === 0
      && (batch.solicitacoes || []).length === 0
      && (batch.arquivos || []).length === 0
    );
  }

  _serializeFields(data, fields = []) {
    const payload = { ...data };

    for (const field of fields) {
      if (payload[field] !== undefined && payload[field] !== null) {
        if (typeof payload[field] === "object") {
          payload[field] = JSON.stringify(payload[field]);
        }
      }
    }

    return payload;
  }

  _parseMetadata(metadata) {
    if (!metadata) return {};
    if (typeof metadata === "object") return metadata;
    if (typeof metadata === "string") {
      try {
        return JSON.parse(metadata);
      } catch (_error) {
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
  async getPendingData(userId, lastSyncDate, options = {}) {
    const lastSync = lastSyncDate ? new Date(lastSyncDate) : null;
    const hasValidLastSync = lastSync && !Number.isNaN(lastSync.getTime());

    // Limite configurável — evita respostas gigantes em conexão lenta
    const defaultLimit = parseInt(process.env.SYNC_BATCH_LIMIT) || 100;
    const maxLimit     = parseInt(process.env.SYNC_BATCH_LIMIT_MAX) || 500;
    const limit = Math.min(Math.max(1, parseInt(options.limit) || defaultLimit), maxLimit);
    const page  = Math.max(1, parseInt(options.page) || 1);

    const [medicoes, diarios, solicitacoes, arquivos] = await Promise.all([
      medicaoRepository.findAll({ responsavel: userId }, { limit, page }),
      diarioRepository.findAll({ responsavel: userId }, { limit, page }),
      solicitacaoCompraRepository.findAll({ solicitante: userId }, { limit, page }),
      arquivoRepository.findAll({ uploadedBy: userId }, { limit, page }),
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
      pagination: { page, limit },
      timestamp: new Date(),
    };
  }

  /**
   * Processa sincronização em lote (push do cliente)
   */
  async pushBatch(batchData, userId) {
    const userRepository = require("../repositories/UserRepository");
    const user = await userRepository.findById(userId);
    const userPerfil = user?.perfil || "encarregado";

    const results = {
      success: [],
      conflicts: [],
      errors: [],
    };

    // Processar medições
    if (batchData.medicoes && batchData.medicoes.length > 0) {
      for (const medicao of batchData.medicoes) {
        try {
          const result = await this.syncMedicao(medicao, userId, userPerfil);
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

    // Processar solitações
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

    // Processar arquivos/fotos enviados offline (base64)
    if (batchData.arquivos && batchData.arquivos.length > 0) {
      for (const arquivo of batchData.arquivos) {
        try {
          const result = await this.syncArquivo(arquivo, userId);
          results.success.push({
            type: "arquivo",
            id: result.id || result._id || null,
            syncId: arquivo.syncId,
          });
        } catch (error) {
          results.errors.push({
            type: "arquivo",
            syncId: arquivo.syncId,
            error: error.message,
          });
        }
      }
    }

    // Atualizar lastSync apenas quando não houver erro no lote
    if (results.errors.length === 0) {
      await userRepository.updateLastSync(userId);
    } else {
      logger.warn(
        `[SYNC] lastSync não atualizado para usuário ${userId} devido a ${results.errors.length} erro(s) no lote`,
      );
    }

    return results;
  }

  /**
   * Sincroniza uma medição (Last-Write-Wins com proteção de status finais)
   */
  async syncMedicao(medicaoData, userId, userPerfil = "encarregado") {
    if (!medicaoData.syncId) {
      throw new ValidationError("syncId é obrigatório para sincronização");
    }

    // Buscar medição existente pelo syncId
    const existing = await medicaoRepository.findBySyncId(medicaoData.syncId);

    if (existing) {
      // Impede rollback de aprovação/rejeição por cliente offline
      const FINAL_STATUSES = ["aprovada", "rejeitada"];
      if (FINAL_STATUSES.includes(existing.status)) {
        logger.info(
          `Sync ignorado — medição ${medicaoData.syncId} já possui status final: ${existing.status}`,
        );
        return existing;
      }

      // Resolver conflito usando Last-Write-Wins
      if (this._isClientNewer(medicaoData.clientTimestamp, existing)) {
        const normalizedPayload = this._serializeFields(medicaoData, [
          "periodo",
          "itens",
          "anexos",
          "metadata",
        ]);

        // Cliente mais recente, atualizar
        logger.info(
          `Resolvendo conflito de medição ${medicaoData.syncId} - Cliente vence`,
        );
        const existingId = existing.id || existing._id;
        const updated = await medicaoRepository.update(existingId, {
          ...normalizedPayload,
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
      userPerfil,
    );
  }

  /**
   * Sincroniza um diário (Last-Write-Wins com proteção de status finais)
   */
  async syncDiario(diarioData, userId) {
    if (!diarioData.syncId) {
      throw new ValidationError("syncId é obrigatório para sincronização");
    }

    const existing = await diarioRepository.findBySyncId(diarioData.syncId);

    if (existing) {
      // Impede sobrescrita de diários com status final (ex: aprovado pelo supervisor)
      if (existing.status && FINAL_STATUSES.includes(existing.status)) {
        logger.info(
          `Sync ignorado — diário ${diarioData.syncId} já possui status final: ${existing.status}`,
        );
        return existing;
      }

      if (this._isClientNewer(diarioData.clientTimestamp, existing)) {
        const normalizedPayload = this._serializeFields(diarioData, [
          "equipamentos",
          "maoDeObra",
          "atividades",
          "materiais",
          "ocorrencias",
          "visitantes",
          "fotos",
          "metadata",
        ]);

        logger.info(
          `Resolvendo conflito de diário ${diarioData.syncId} - Cliente vence`,
        );
        const existingId = existing.id || existing._id;
        return await diarioRepository.update(existingId, {
          ...normalizedPayload,
          sincronizado: true,
        });
      } else {
        logger.info(
          `Resolvendo conflito de diário ${diarioData.syncId} - Servidor vence`,
        );
        return existing;
      }
    }

    const normalizedPayload = this._serializeFields(diarioData, [
      "equipamentos",
      "maoDeObra",
      "atividades",
      "materiais",
      "ocorrencias",
      "visitantes",
      "fotos",
      "metadata",
    ]);

    return await diarioRepository.create({
      ...normalizedPayload,
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
      throw new ValidationError("syncId é obrigatório para sincronização");
    }

    const existing = await solicitacaoCompraRepository.findBySyncId(
      solicitacaoData.syncId,
    );

    if (existing) {
      if (this._isClientNewer(solicitacaoData.clientTimestamp, existing)) {
        const normalizedPayload = this._serializeFields(solicitacaoData, [
          "itens",
          "anexos",
          "metadata",
        ]);

        logger.info(
          `Resolvendo conflito de solicitação ${solicitacaoData.syncId} - Cliente vence`,
        );
        const existingId = existing.id || existing._id;
        return await solicitacaoCompraRepository.update(existingId, {
          ...normalizedPayload,
          sincronizado: true,
        });
      } else {
        logger.info(
          `Resolvendo conflito de solicitação ${solicitacaoData.syncId} - Servidor vence`,
        );
        return existing;
      }
    }

    const normalizedPayload = this._serializeFields(solicitacaoData, [
      "itens",
      "anexos",
      "metadata",
    ]);

    return await solicitacaoCompraRepository.create({
      ...normalizedPayload,
      solicitante: userId,
      sincronizado: true,
      metadata: { createdBy: userId },
    });
  }

  /**
   * Sincroniza um arquivo/foto enviado offline em base64.
   * Converte base64 → Buffer e usa ArquivoService.processUpload para manter
   * toda a lógica de compressão, validação de magic bytes e storage.
   */
  async syncArquivo(arquivoData, userId) {
    if (!arquivoData.syncId) {
      throw new ValidationError("syncId é obrigatório para sincronização");
    }

    // Idempotência: se já existe no banco, retorna sem reprocessar
    const existing = await arquivoRepository.findBySyncId(arquivoData.syncId);
    if (existing) {
      logger.info(`Sync de arquivo ignorado — syncId ${arquivoData.syncId} já existe (id=${existing.id})`);
      return existing;
    }

    if (!arquivoData.base64) {
      throw new ValidationError("Campo 'base64' é obrigatório para sync de arquivos");
    }

    // Converte base64 para Buffer (mantém compatibilidade com ArquivoService)
    const buffer = Buffer.from(arquivoData.base64, "base64");

    const file = {
      buffer,
      size:         buffer.length,
      originalname: arquivoData.originalname || "foto_offline.jpg",
      mimetype:     arquivoData.mimeType,
    };

    const metadata = {
      obra:             arquivoData.obra,
      tipo:             arquivoData.tipo             || "foto_obra",
      tipoArquivo:      arquivoData.tipoArquivo,
      descricao:        arquivoData.descricao        || "Enviado offline",
      coordenadas:      arquivoData.coordenadas      || null,
      tags:             arquivoData.tags             || null,
      solicitadoPor:    arquivoData.solicitadoPor    || null,
      detalheProblema:  arquivoData.detalheProblema  || null,
      syncId:           arquivoData.syncId,
    };

    // processUpload já gerencia compressão, magic bytes e persistência
    const arquivoService = _getArquivoService();
    const resultado = await arquivoService.processUpload(file, metadata, userId);

    logger.info(`[SYNC] Arquivo offline sincronizado — syncId: ${arquivoData.syncId} | id: ${resultado.id}`);
    return resultado;
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
    let lastError;
    const baseDelay = parseInt(process.env.SYNC_RETRY_DELAY) || 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await syncFunction();
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Retry real de sincronização em lote: reenvia apenas os itens que falharam.
   */
  async retryBatch(batchData, userId, maxAttempts = 3) {
    const delay = parseInt(process.env.SYNC_RETRY_DELAY) || 1000;
    const aggregated = {
      success: [],
      conflicts: [],
      errors: [],
      attempts: 0,
    };

    let pendingBatch = {
      medicoes: [...(batchData.medicoes || [])],
      diarios: [...(batchData.diarios || [])],
      solicitacoes: [...(batchData.solicitacoes || [])],
      arquivos: [...(batchData.arquivos || [])],
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (this._isBatchEmpty(pendingBatch)) break;

      const result = await this.pushBatch(pendingBatch, userId);
      aggregated.attempts = attempt;
      aggregated.success.push(...result.success);
      aggregated.conflicts.push(...result.conflicts);

      if (!result.errors.length) {
        aggregated.errors = [];
        return aggregated;
      }

      aggregated.errors = result.errors;
      pendingBatch = this._extractRetryableBatch(pendingBatch, result.errors);

      if (attempt < maxAttempts && !this._isBatchEmpty(pendingBatch)) {
        await sleep(delay * Math.pow(2, attempt - 1));
      }
    }

    return aggregated;
  }
}

module.exports = new SyncService();
