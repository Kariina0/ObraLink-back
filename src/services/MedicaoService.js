const medicaoRepository = require("../repositories/MedicaoRepository");
const obraRepository = require("../repositories/ObraRepository");
const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} = require("../utils/errors");
const { generateSyncId } = require("../utils/helpers");
const { PERFIS } = require("../constants");

class MedicaoService {
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
    const comprimento = medicaoData.comprimento != null ? Number(medicaoData.comprimento) : null;
    const largura     = medicaoData.largura     != null ? Number(medicaoData.largura)     : null;
    const altura      = medicaoData.altura      != null ? Number(medicaoData.altura)      : null;

    if (comprimento != null && largura != null && !isNaN(comprimento) && !isNaN(largura)) {
      medicaoData.areaCalculada = comprimento * largura;
      if (altura != null && !isNaN(altura)) {
        medicaoData.volume = comprimento * largura * altura;
      }
    }

    // Serializar arrays JSON para SQLite
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
    return await medicaoRepository.findById(medicaoId, [
      "obra",
      "responsavel",
      "anexos",
    ]);
  }

  async update(medicaoId, medicaoData, userId, userPerfil) {
    const medicao = await medicaoRepository.findById(medicaoId);

    // Verificar permissão
    if (
      Number(medicao.responsavel) !== Number(userId) &&
      userPerfil === PERFIS.ENCARREGADO
    ) {
      throw new ForbiddenError(
        "Você não tem permissão para editar esta medição",
      );
    }

    // Não permitir edição de medições já enviadas para fluxo de aprovação
    if (medicao.status !== "rascunho" && userPerfil !== PERFIS.ADMIN) {
      throw new ValidationError("Apenas medições em rascunho podem ser editadas");
    }

    // Recalcular areaCalculada e volume se dimensões foram atualizadas
    const comprimento = medicaoData.comprimento != null ? Number(medicaoData.comprimento) : null;
    const largura     = medicaoData.largura     != null ? Number(medicaoData.largura)     : null;
    const altura      = medicaoData.altura      != null ? Number(medicaoData.altura)      : null;

    if (comprimento != null && largura != null && !isNaN(comprimento) && !isNaN(largura)) {
      medicaoData.areaCalculada = comprimento * largura;
      medicaoData.volume = (altura != null && !isNaN(altura))
        ? comprimento * largura * altura
        : null;
    }

    // Serializar arrays JSON para SQLite
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
    return await medicaoRepository.findById(updatedId, [
      "obra",
      "responsavel",
      "anexos",
    ]);
  }

  async getById(medicaoId, userId, userPerfil) {
    const medicao = await medicaoRepository.findById(medicaoId, [
      "obra",
      "responsavel",
      "anexos",
      "aprovadoPor",
    ]);

    if (
      userPerfil === PERFIS.ENCARREGADO &&
      Number(medicao.responsavel) !== Number(userId)
    ) {
      throw new ForbiddenError(
        "Você não tem permissão para acessar esta medição"
      );
    }

    return medicao;
  }

  async getByObra(obraId, options, userId, userPerfil, obraAtual) {
    if (userPerfil === PERFIS.ENCARREGADO) {
      // Verificar vínculo pelo N:N
      const vinculado = await obraRepository.isEncarregadoVinculado(obraId, userId);
      if (!vinculado) {
        throw new ForbiddenError(
          "Você não tem permissão para acessar medições desta obra"
        );
      }

      return await medicaoRepository.findAll(
        { obra: Number(obraId), responsavel: userId },
        options
      );
    }

    return await medicaoRepository.findByObra(obraId, options);
  }

  async getByResponsavel(userId, options, filters = {}) {
    // Se nenhum filtro extra foi informado, usa consulta simples (mais rápida)
    const hasFilters = filters.obra || filters.status || filters.tipoServico
      || filters.area || filters.dataInicio || filters.dataFim;

    if (hasFilters) {
      return await medicaoRepository.findByResponsavelFiltered(userId, filters, options);
    }
    return await medicaoRepository.findByResponsavel(userId, options);
  }

  async getAll(options, userPerfil, filters = {}) {
    // Apenas supervisores e admins podem ver todas as medições
    if (![PERFIS.SUPERVISOR, PERFIS.ADMIN].includes(userPerfil)) {
      throw new ForbiddenError(
        "Apenas supervisores e administradores podem listar todas as medições"
      );
    }
    return await medicaoRepository.findAllFiltered(filters, options);
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

    return await medicaoRepository.updateStatus(medicaoId, "aprovada", userId);
  }

  async rejeitar(medicaoId, userId, userPerfil) {
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
      throw new ValidationError("Não é possível rejeitar uma medição já aprovada");
    }

    return await medicaoRepository.updateStatus(medicaoId, "rejeitada", userId);
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
