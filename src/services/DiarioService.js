const diarioRepository = require("../repositories/DiarioRepository");
const obraRepository   = require("../repositories/ObraRepository");
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
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
  _normalizeDateInput(value) {
    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    if (typeof value === "string") {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const [, year, month, day] = match;
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0));
      }
    }

    return new Date(value);
  }

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
   * Impede duplicidade: apenas um diário por obra por dia.
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

    // Impede cadastro de diário com data futura
    const dataRegistro = diarioData.data ? this._normalizeDateInput(diarioData.data) : new Date();
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    if (dataRegistro > hoje) {
      throw new ConflictError("Não é possível registrar diário com data futura");
    }

    // Impede duplicidade: um diário por obra por dia
    const existente = await diarioRepository.findByData(diarioData.obra, dataRegistro);
    if (existente) {
      throw new ConflictError(
        "Já existe um diário registrado para esta obra nesta data",
      );
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
    return await diarioRepository.findByIdWithNames(newId);
  }

  /**
   * Lista diários do usuário logado com paginação.
   * Suporta filtros: obra, dataInicio, dataFim.
   */
  async getByResponsavel(userId, { page = 1, limit = 10, obra, dataInicio, dataFim } = {}) {
    if (dataInicio || dataFim) {
      const inicio = dataInicio ? this._normalizeDateInput(dataInicio) : new Date("2000-01-01T12:00:00");
      const fim    = dataFim   ? this._normalizeDateInput(dataFim)    : new Date();
      fim.setHours(23, 59, 59, 999);

      const obraId = obra ? Number(obra) : null;
      return await diarioRepository.findByPeriodoResponsavel(userId, inicio, fim, { page, limit, obraId });
    }

    const filters = { responsavel: userId };
    if (obra) filters.obra = Number(obra);
    return await diarioRepository.findAllWithNames(filters, { page, limit });
  }

  /**
   * Lista todos os diários (supervisor/admin).
   * Suporta filtros: obra, dataInicio, dataFim, page, limit.
   */
  async getAll({ page = 1, limit = 10, obra, dataInicio, dataFim } = {}) {
    if (dataInicio || dataFim) {
      const inicio = dataInicio ? this._normalizeDateInput(dataInicio) : new Date("2000-01-01T12:00:00");
      const fim    = dataFim   ? this._normalizeDateInput(dataFim)    : new Date();
      fim.setHours(23, 59, 59, 999);

      const obraId = obra ? Number(obra) : null;
      return await diarioRepository.findByPeriodoGlobal(inicio, fim, { page, limit, obraId });
    }

    const filters = obra ? { obra: Number(obra) } : {};
    return await diarioRepository.findAllWithNames(filters, { page, limit });
  }

  /** Retorna um diário por ID. */
  async getById(diarioId, userId, userPerfil) {
    const diario = await diarioRepository.findByIdWithNames(diarioId);

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

    // Se a data foi alterada, verificar duplicidade na nova data
    if (diarioData.data) {
      const novaData = this._normalizeDateInput(diarioData.data);
      const hoje = new Date();
      hoje.setHours(23, 59, 59, 999);
      if (novaData > hoje) {
        throw new ConflictError("Não é possível registrar diário com data futura");
      }

      // Verifica duplicidade apenas se a data mudou
      const dataAtual = this._normalizeDateInput(diario.data);
      if (novaData.toISOString().slice(0, 10) !== dataAtual.toISOString().slice(0, 10)) {
        const existente = await diarioRepository.findByData(diario.obra, novaData);
        if (existente && existente.id !== Number(diarioId)) {
          throw new ConflictError(
            "Já existe um diário registrado para esta obra nesta data",
          );
        }
      }
    }

    const payload = this._serialize(diarioData);
    await diarioRepository.update(diarioId, payload);
    return await diarioRepository.findByIdWithNames(diarioId);
  }

  /** Remove um diário (soft delete via coluna deletedAt). */
  async delete(diarioId, userId, userPerfil) {
    const diario = await diarioRepository.findById(diarioId);

    // Encarregado só remove seus próprios diários
    if (
      userPerfil === PERFIS.ENCARREGADO &&
      Number(diario.responsavel) !== Number(userId)
    ) {
      throw new ForbiddenError("Você não tem permissão para excluir este diário");
    }

    await diarioRepository.update(diarioId, { deletedAt: new Date().toISOString() });
    return { deleted: true };
  }

  /**
   * Verifica se já existe um diário para uma obra em uma data específica.
   * Usado pelo frontend antes de submeter o formulário.
   */
  async checkDuplicata(obraId, data) {
    const existente = await diarioRepository.findByData(
      obraId,
      this._normalizeDateInput(data),
    );
    return { exists: !!existente, id: existente?.id ?? null };
  }
}

module.exports = new DiarioService();
