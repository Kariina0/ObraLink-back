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
    return await medicaoRepository.findById(medicao._id, [
      "obra",
      "responsavel",
      "anexos",
    ]);
  }

  async update(medicaoId, medicaoData, userId, userPerfil) {
    const medicao = await medicaoRepository.findById(medicaoId);

    // Verificar permissão
    if (
      medicao.responsavel.toString() !== userId &&
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
    return await medicaoRepository.findById(updated._id, [
      "obra",
      "responsavel",
      "anexos",
    ]);
  }

  async getById(medicaoId) {
    return await medicaoRepository.findById(medicaoId, [
      "obra",
      "responsavel",
      "anexos",
      "aprovadoPor",
    ]);
  }

  async getByObra(obraId, options) {
    return await medicaoRepository.findByObra(obraId, options);
  }

  async getByResponsavel(userId, options) {
    return await medicaoRepository.findByResponsavel(userId, options);
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
      medicao.responsavel.toString() !== userId &&
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
          return await medicaoRepository.update(existing._id, medicaoData);
        }
        return existing;
      }
    }

    // Criar nova medição
    return await this.create(medicaoData, userId);
  }
}

module.exports = new MedicaoService();
