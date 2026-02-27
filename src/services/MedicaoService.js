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
  async create(medicaoData, userId) {
    // Verificar se obra existe
    const obra = await obraRepository.findById(medicaoData.obra);
    if (!obra) {
      throw new NotFoundError("Obra não encontrada");
    }

    // Gerar syncId se não fornecido
    if (!medicaoData.syncId) {
      medicaoData.syncId = generateSyncId();
    }

    // Adicionar responsável
    medicaoData.responsavel = userId;
    medicaoData.metadata = {
      createdBy: userId,
    };

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

    // Não permitir edição de medições aprovadas
    if (medicao.status === "aprovada" && userPerfil !== PERFIS.ADMIN) {
      throw new ValidationError("Não é possível editar medições aprovadas");
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
      if (obraAtual && Number(obraAtual) !== Number(obraId)) {
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

  async getByResponsavel(userId, options) {
    return await medicaoRepository.findByResponsavel(userId, options);
  }

  async getAll(options, userPerfil) {
    // Apenas supervisores e admins podem ver todas as medições
    if (![PERFIS.SUPERVISOR, PERFIS.ADMIN].includes(userPerfil)) {
      throw new ForbiddenError(
        "Apenas supervisores e administradores podem listar todas as medições"
      );
    }
    return await medicaoRepository.findAll({}, options);
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

  async syncMedicao(medicaoData, userId) {
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
    return await this.create(medicaoData, userId);
  }
}

module.exports = new MedicaoService();
