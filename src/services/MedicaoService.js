const medicaoRepository = require("../repositories/MedicaoRepository");
const obraRepository = require("../repositories/ObraRepository");
const arquivoRepository = require("../repositories/ArquivoRepository");
const storageService = require("./StorageService");
const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} = require("../utils/errors");
const { generateSyncId } = require("../utils/helpers");
const { PERFIS } = require("../constants");

class MedicaoService {
  _isBlank(value) {
    return value == null || String(value).trim() === "";
  }

  _normalizeItens(rawItens) {
    if (typeof rawItens === "string") {
      try {
        return JSON.parse(rawItens);
      } catch {
        return [];
      }
    }
    return rawItens;
  }

  _validateEnviadaPayload(baseMedicao, patchData) {
    const area = patchData.area !== undefined ? patchData.area : baseMedicao.area;
    const tipoServico =
      patchData.tipoServico !== undefined
        ? patchData.tipoServico
        : baseMedicao.tipoServico;
    const itens =
      patchData.itens !== undefined ? patchData.itens : baseMedicao.itens;

    const itensNormalizados = this._normalizeItens(itens);

    if (this._isBlank(area)) {
      throw new ValidationError(
        "Para enviar a medição, o campo 'area' é obrigatório",
      );
    }

    if (this._isBlank(tipoServico)) {
      throw new ValidationError(
        "Para enviar a medição, o campo 'tipoServico' é obrigatório",
      );
    }

    if (!Array.isArray(itensNormalizados) || itensNormalizados.length === 0) {
      throw new ValidationError(
        "Para enviar a medição, é necessário informar pelo menos um item",
      );
    }
  }

  _extractAnexoIds(anexos) {
    let parsed = anexos;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = [];
      }
    }

    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => {
        // Compatibilidade com payload legado: anexos como objetos { id, ... }
        if (value && typeof value === "object") {
          return Number(value.id);
        }
        return Number(value);
      })
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  async _hydrateAttachmentUrls(arquivos) {
    await Promise.allSettled(
      arquivos
        .filter(
          (arquivo) =>
            arquivo.storage_provider === "supabase" && arquivo.storage_path,
        )
        .map(async (arquivo) => {
          arquivo.storage_url = await storageService.getSignedUrl(
            arquivo.storage_path,
            3600,
            arquivo.storage_provider,
          );
        }),
    );
  }

  async _attachMeasurementFiles(medicoes) {
    const items = Array.isArray(medicoes) ? medicoes : [medicoes];
    if (items.length === 0) return medicoes;

    const attachmentIds = [
      ...new Set(
        items.flatMap((medicao) => this._extractAnexoIds(medicao?.anexos)),
      ),
    ];
    if (attachmentIds.length === 0) {
      for (const medicao of items) {
        medicao.anexosDetalhes = [];
        medicao.fotoUrl = null;
      }
      return medicoes;
    }

    const arquivos = await arquivoRepository.findByIds(attachmentIds);
    await this._hydrateAttachmentUrls(arquivos);

    const arquivoById = new Map(
      arquivos.map((arquivo) => [
        Number(arquivo.id),
        {
          id: arquivo.id,
          nome: arquivo.nome,
          nomeOriginal: arquivo.nomeOriginal,
          url: arquivo.storage_url || arquivo.url,
          storage_url: arquivo.storage_url || null,
          mimeType: arquivo.mimeType,
          tipo: arquivo.tipo,
          descricao: arquivo.descricao,
          storageProvider: arquivo.storage_provider || "local",
        },
      ]),
    );

    for (const medicao of items) {
      const anexosDetalhes = this._extractAnexoIds(medicao?.anexos)
        .map((id) => arquivoById.get(id))
        .filter(Boolean);

      medicao.anexosDetalhes = anexosDetalhes;
      medicao.fotoUrl = anexosDetalhes[0]?.url || null;
    }

    return medicoes;
  }

  async create(medicaoData, userId, userPerfil) {
    // Verificar se obra existe
    const obra = await obraRepository.findById(medicaoData.obra);
    if (!obra) {
      throw new NotFoundError("Obra não encontrada");
    }

    // Encarregado só pode registrar medição em obra à qual está vinculado
    if (userPerfil === PERFIS.ENCARREGADO) {
      const vinculado = await obraRepository.isEncarregadoVinculado(
        medicaoData.obra,
        userId,
      );
      if (!vinculado) {
        throw new ForbiddenError(
          "Você não está vinculado a esta obra e não pode registrar medições nela",
        );
      }
    }

    // Gerar syncId se não fornecido
    if (!medicaoData.syncId) {
      medicaoData.syncId = generateSyncId();
    }

    // Calcular areaCalculada e volume automaticamente a partir das dimensões
    const comprimento =
      medicaoData.comprimento != null ? Number(medicaoData.comprimento) : null;
    const largura =
      medicaoData.largura != null ? Number(medicaoData.largura) : null;
    const altura =
      medicaoData.altura != null ? Number(medicaoData.altura) : null;

    if (
      comprimento != null &&
      largura != null &&
      !isNaN(comprimento) &&
      !isNaN(largura)
    ) {
      medicaoData.areaCalculada = comprimento * largura;
      if (altura != null && !isNaN(altura)) {
        medicaoData.volume = comprimento * largura * altura;
      }
    }

    // Serializar arrays como JSON string (coluna TEXT no PostgreSQL)
    if (medicaoData.itens) {
      medicaoData.itens = JSON.stringify(medicaoData.itens);
    }
    if (medicaoData.anexos) {
      medicaoData.anexos = JSON.stringify(medicaoData.anexos);
    }
    if (medicaoData.periodo) {
      medicaoData.periodo = JSON.stringify(medicaoData.periodo);
    }

    // Adicionar responsável
    medicaoData.responsavel = userId;
    medicaoData.metadata = JSON.stringify({
      createdBy: userId,
    });

    // Criar medição
    const medicao = await medicaoRepository.create(medicaoData);
    const medicaoId = medicao.id || medicao._id || medicao;
    const created = await medicaoRepository.findById(medicaoId, [
      "obra",
      "responsavel",
      "anexos",
    ]);
    await this._attachMeasurementFiles(created);
    return created;
  }

  async update(medicaoId, medicaoData, userId, userPerfil) {
    const medicao = await medicaoRepository.findById(medicaoId);

    // Aprovação/rejeição devem ocorrer somente pelos endpoints dedicados
    if (["aprovada", "rejeitada"].includes(medicaoData.status)) {
      throw new ValidationError(
        "Use os endpoints de aprovação/rejeição para alterar este status",
      );
    }

    // Rascunho: apenas o criador pode editar, independente do perfil
    if (
      medicao.status === "rascunho" &&
      Number(medicao.responsavel) !== Number(userId)
    ) {
      throw new ForbiddenError(
        "Você não tem permissão para editar este rascunho",
      );
    }

    // Verificar permissão
    if (
      Number(medicao.responsavel) !== Number(userId) &&
      userPerfil === PERFIS.ENCARREGADO
    ) {
      throw new ForbiddenError(
        "Você não tem permissão para editar esta medição",
      );
    }

    // Não permitir edição de medições aprovadas
    if (medicao.status === "aprovada" && userPerfil !== PERFIS.ADMIN) {
      throw new ValidationError("Não é possível editar medições aprovadas");
    }

    // Transição para enviada exige dados mínimos completos
    if (medicaoData.status === "enviada") {
      this._validateEnviadaPayload(medicao, medicaoData);
    }

    // Recalcular areaCalculada e volume se dimensões foram atualizadas
    const comprimento =
      medicaoData.comprimento != null ? Number(medicaoData.comprimento) : null;
    const largura =
      medicaoData.largura != null ? Number(medicaoData.largura) : null;
    const altura =
      medicaoData.altura != null ? Number(medicaoData.altura) : null;

    if (
      comprimento != null &&
      largura != null &&
      !isNaN(comprimento) &&
      !isNaN(largura)
    ) {
      medicaoData.areaCalculada = comprimento * largura;
      medicaoData.volume =
        altura != null && !isNaN(altura)
          ? comprimento * largura * altura
          : null;
    }

    // Serializar arrays como JSON string (coluna TEXT no PostgreSQL)
    if (medicaoData.itens) {
      medicaoData.itens = JSON.stringify(medicaoData.itens);
    }
    if (medicaoData.anexos) {
      medicaoData.anexos = JSON.stringify(medicaoData.anexos);
    }
    if (medicaoData.periodo) {
      medicaoData.periodo = JSON.stringify(medicaoData.periodo);
    }

    // Atualizar
    const updated = await medicaoRepository.update(medicaoId, medicaoData);
    const updatedId = updated.id || updated._id || medicaoId;
    const refreshed = await medicaoRepository.findById(updatedId, [
      "obra",
      "responsavel",
      "anexos",
    ]);
    await this._attachMeasurementFiles(refreshed);
    return refreshed;
  }

  async getById(medicaoId, userId, userPerfil) {
    const medicao = await medicaoRepository.findById(medicaoId, [
      "obra",
      "responsavel",
      "anexos",
      "aprovadoPor",
    ]);

    // Rascunhos são privados: apenas o criador pode acessar, independente do perfil
    if (
      medicao.status === "rascunho" &&
      Number(medicao.responsavel) !== Number(userId)
    ) {
      throw new ForbiddenError(
        "Você não tem permissão para acessar este rascunho",
      );
    }

    if (
      userPerfil === PERFIS.ENCARREGADO &&
      Number(medicao.responsavel) !== Number(userId)
    ) {
      throw new ForbiddenError(
        "Você não tem permissão para acessar esta medição",
      );
    }

    await this._attachMeasurementFiles(medicao);
    return medicao;
  }

  async getByObra(
    obraId,
    options,
    userId,
    userPerfil,
    obraAtual,
    filters = {},
  ) {
    // Rascunhos são privados ao criador — excluir de todas as listagens por obra
    const baseFilters = { ...filters };
    if (baseFilters.status === "rascunho") {
      delete baseFilters.status;
    }
    baseFilters.excludeDrafts = true;

    if (userPerfil === PERFIS.ENCARREGADO) {
      // Verificar vínculo pelo N:N
      const vinculado = await obraRepository.isEncarregadoVinculado(
        obraId,
        userId,
      );
      if (!vinculado) {
        throw new ForbiddenError(
          "Você não tem permissão para acessar medições desta obra",
        );
      }

      const result = await medicaoRepository.findAllFiltered(
        { obra: Number(obraId), responsavel: userId, ...baseFilters },
        options,
      );
      await this._attachMeasurementFiles(result.data);
      return result;
    }

    const result = await medicaoRepository.findAllFiltered(
      { obra: Number(obraId), ...baseFilters },
      options,
    );
    await this._attachMeasurementFiles(result.data);
    return result;
  }

  async getByResponsavel(userId, options, filters = {}) {
    // Se nenhum filtro extra foi informado, usa consulta simples (mais rápida)
    const hasFilters =
      filters.obra ||
      filters.status ||
      filters.tipoServico ||
      filters.area ||
      filters.dataInicio ||
      filters.dataFim;

    // Modificação: Excluir rascunhos por padrão
    // Se o usuário não especificar um filtro de status, excluir rascunhos automaticamente
    const scopedFilters = { ...filters, responsavel: userId };
    if (!filters.status) {
      // Excluir rascunhos por padrão (para /minhas retornar apenas medições enviadas, aprovadas ou rejeitadas)
      scopedFilters.excludeDrafts = true;
    }

    const statusSummary =
      await medicaoRepository.getStatusSummaryFiltered(scopedFilters);

    if (hasFilters) {
      // Usar scopedFilters para garantir que excludeDrafts seja aplicado
      // quando nenhum filtro de status específico foi informado
      const result = await medicaoRepository.findByResponsavelFiltered(
        userId,
        scopedFilters,
        options,
      );
      await this._attachMeasurementFiles(result.data);
      return { ...result, statusSummary };
    }

    // Busca simples também deve excluir rascunhos
    const result = await medicaoRepository.findByResponsavelExcludingDrafts(userId, options);
    await this._attachMeasurementFiles(result.data);
    return { ...result, statusSummary };
  }

  async getAll(options, userPerfil, filters = {}) {
    // Apenas supervisores e admins podem ver todas as medições
    if (![PERFIS.SUPERVISOR, PERFIS.ADMIN].includes(userPerfil)) {
      throw new ForbiddenError(
        "Apenas supervisores e administradores podem listar todas as medições",
      );
    }

    // Rascunhos são privados ao criador — supervisores/admins NUNCA visualizam
    // rascunhos de outros usuários na listagem geral.
    const scopedFilters = { ...filters };
    if (scopedFilters.status === "rascunho") {
      delete scopedFilters.status;
    }
    scopedFilters.excludeDrafts = true;

    const [result, statusSummary] = await Promise.all([
      medicaoRepository.findAllFiltered(scopedFilters, options),
      medicaoRepository.getStatusSummaryFiltered(scopedFilters),
    ]);

    // Rascunhos nunca são contabilizados no sumário da visão geral
    statusSummary.rascunho = 0;

    await this._attachMeasurementFiles(result.data);

    return { ...result, statusSummary };
  }

  async aprovar(medicaoId, userId, userPerfil) {
    // Apenas supervisores e admins podem aprovar
    if (![PERFIS.SUPERVISOR, PERFIS.ADMIN].includes(userPerfil)) {
      throw new ForbiddenError(
        "Apenas supervisores e administradores podem aprovar medições",
      );
    }

    const medicao = await medicaoRepository.findById(medicaoId);

    if (medicao.status === "aprovada") {
      throw new ValidationError("Medição já está aprovada");
    }

    const updatedMedicao = await medicaoRepository.updateStatus(
      medicaoId,
      "aprovada",
      userId,
    );
    await this._attachMeasurementFiles(updatedMedicao);
    return updatedMedicao;
  }

  async rejeitar(medicaoId, userId, userPerfil, motivoRejeicao = null) {
    if (![PERFIS.SUPERVISOR, PERFIS.ADMIN].includes(userPerfil)) {
      throw new ForbiddenError(
        "Apenas supervisores e administradores podem rejeitar medições",
      );
    }

    // Verificar status atual para evitar rejeições duplicadas (I-4)
    const medicao = await medicaoRepository.findById(medicaoId);
    if (medicao.status === "rejeitada") {
      throw new ValidationError("Medição já está rejeitada");
    }
    if (medicao.status === "aprovada") {
      throw new ValidationError(
        "Não é possível rejeitar uma medição já aprovada",
      );
    }

    const updatedMedicao = await medicaoRepository.updateStatus(
      medicaoId,
      "rejeitada",
      userId,
      motivoRejeicao,
    );
    await this._attachMeasurementFiles(updatedMedicao);
    return updatedMedicao;
  }

  async delete(medicaoId, userId, userPerfil) {
    const medicao = await medicaoRepository.findById(medicaoId);

    // Verificar permissão
    if (
      Number(medicao.responsavel) !== Number(userId) &&
      userPerfil !== PERFIS.ADMIN
    ) {
      throw new ForbiddenError(
        "Você não tem permissão para excluir esta medição",
      );
    }

    return await medicaoRepository.delete(medicaoId);
  }

  async syncMedicao(medicaoData, userId, userPerfil) {
    // Verificar se já existe pelo syncId
    if (medicaoData.syncId) {
      const existing = await medicaoRepository.findBySyncId(medicaoData.syncId);

      if (existing) {
        // Resolver conflito (Last-Write-Wins)
        if (medicaoData.clientTimestamp > existing.clientTimestamp) {
          const existingId = existing.id || existing._id;
          return await medicaoRepository.update(existingId, medicaoData);
        }
        return existing;
      }
    }

    // Criar nova medição
    return await this.create(medicaoData, userId, userPerfil);
  }
}

module.exports = new MedicaoService();
