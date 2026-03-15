const diarioRepository = require("../repositories/DiarioRepository");
const obraRepository   = require("../repositories/ObraRepository");
const {
  NotFoundError,
  ForbiddenError,
} = require("../utils/errors");
const { generateSyncId } = require("../utils/helpers");
const { PERFIS } = require("../constants");

/** Campos serializados como JSON no SQLite */
const JSON_FIELDS = [
  "atividades",
  "equipamentos",
  "maoDeObra",
  "materiais",
  "ocorrencias",
  "visitantes",
  "fotos",
];

class DiarioService {
  /** Serializa campos JSON para string antes de gravar no SQLite */
  _serialize(data) {
    const out = { ...data };
    for (const field of JSON_FIELDS) {
      if (out[field] !== undefined) {
        out[field] = JSON.stringify(out[field]);
      }
    }
    return out;
  }

  /**
   * Cria um novo registro de Diário de Obra.
   * Encarregados só podem registrar diários em obras às quais estão vinculados.
   */
  async create(diarioData, userId, userPerfil) {
    // Verificar se obra existe
    const obra = await obraRepository.findById(diarioData.obra);
    if (!obra) {
      throw new NotFoundError("Obra não encontrada");
    }

    // Encarregado só pode registrar em obra vinculada
    if (userPerfil === PERFIS.ENCARREGADO) {
      const vinculado = await obraRepository.isEncarregadoVinculado(
        diarioData.obra,
        userId,
      );
      if (!vinculado) {
        throw new ForbiddenError(
          "Você não está vinculado a esta obra e não pode registrar diários nela",
        );
      }
    }

    // Gerar syncId se não fornecido
    if (!diarioData.syncId) {
      diarioData.syncId = generateSyncId();
    }

    diarioData.responsavel = userId;
    diarioData.metadata = JSON.stringify({ createdBy: userId });

    const payload = this._serialize(diarioData);
    const created = await diarioRepository.create(payload);
    const newId = created.id || created._id || created;
    return await diarioRepository.findById(newId);
  }

  /**
   * Lista diários do usuário logado com paginação.
   * Suporta filtros: obra, dataInicio, dataFim.
   */
  async getByResponsavel(userId, { page = 1, limit = 10 } = {}) {
    return await diarioRepository.findAll({ responsavel: userId }, { page, limit });
  }

  /**
   * Lista todos os diários (supervisor/admin).
   * Suporta filtros: obra, page, limit.
   */
  async getAll({ page = 1, limit = 10, obra } = {}) {
    const filters = obra ? { obra: Number(obra) } : {};
    return await diarioRepository.findAll(filters, { page, limit });
  }

  /** Retorna um diário por ID. */
  async getById(diarioId, userId, userPerfil) {
    const diario = await diarioRepository.findById(diarioId);

    // Encarregado só visualiza seus próprios diários
    if (
      userPerfil === PERFIS.ENCARREGADO &&
      Number(diario.responsavel) !== Number(userId)
    ) {
      throw new ForbiddenError("Você não tem permissão para visualizar este diário");
    }

    return diario;
  }

  /** Atualiza um diário existente. */
  async update(diarioId, diarioData, userId, userPerfil) {
    const diario = await diarioRepository.findById(diarioId);

    // Encarregado só edita seus próprios diários
    if (
      userPerfil === PERFIS.ENCARREGADO &&
      Number(diario.responsavel) !== Number(userId)
    ) {
      throw new ForbiddenError("Você não tem permissão para editar este diário");
    }

    const payload = this._serialize(diarioData);
    await diarioRepository.update(diarioId, payload);
    return await diarioRepository.findById(diarioId);
  }

  /** Remove um diário (soft delete via metadata). */
  async delete(diarioId, userId, userPerfil) {
    const diario = await diarioRepository.findById(diarioId);

    // Encarregado só remove seus próprios diários
    if (
      userPerfil === PERFIS.ENCARREGADO &&
      Number(diario.responsavel) !== Number(userId)
    ) {
      throw new ForbiddenError("Você não tem permissão para excluir este diário");
    }

    const meta = (() => {
      try { return JSON.parse(diario.metadata || "{}"); } catch { return {}; }
    })();
    meta.deletedAt = new Date().toISOString();
    meta.deletedBy = userId;

    await diarioRepository.update(diarioId, { metadata: JSON.stringify(meta) });
    return { deleted: true };
  }
}

module.exports = new DiarioService();
