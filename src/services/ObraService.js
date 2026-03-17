const obraRepository = require("../repositories/ObraRepository");
const userRepository = require("../repositories/UserRepository");
const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} = require("../utils/errors");
const { generateSyncId } = require("../utils/helpers");
const { PERFIS, STATUS_OBRA } = require("../constants");

class ObraService {
  /**
   * Cria uma nova obra. Apenas ADMIN pode executar.
   */
  async create(obraData, userId, userPerfil) {
    if (userPerfil !== PERFIS.ADMIN) {
      throw new ForbiddenError("Apenas administradores podem cadastrar obras");
    }

    // Verificar código único
    if (obraData.codigo) {
      const existente = await obraRepository.findByCodigo(obraData.codigo);
      if (existente) {
        throw new ValidationError("Já existe uma obra com este código");
      }
    } else {
      // Gerar código automático se não fornecido
      obraData.codigo = `OBR-${Date.now()}`;
    }

    if (!obraData.syncId) {
      obraData.syncId = generateSyncId();
    }

    obraData.responsavel = userId;
    obraData.metadata = JSON.stringify({ createdBy: userId });

    const obra = await obraRepository.create(obraData);
    const obraId = obra.id || obra;

    // Vincular encarregados informados na criação
    if (Array.isArray(obraData.encarregados)) {
      for (const enc of obraData.encarregados) {
        const uid = typeof enc === "object" ? enc.userId : enc;
        const funcao =
          typeof enc === "object" && enc.funcao ? enc.funcao : "encarregado";
        try {
          await obraRepository.vincularEncarregado(obraId, uid, funcao);
        } catch (_) {
          /* ignora se usuário não existe */
        }
      }
    }

    return await this._hydrate(obraId);
  }

  /**
   * Atualiza uma obra. Apenas ADMIN pode executar.
   */
  async update(obraId, obraData, userPerfil) {
    if (userPerfil !== PERFIS.ADMIN) {
      throw new ForbiddenError("Apenas administradores podem editar obras");
    }

    await obraRepository.findById(obraId); // lança NotFoundError se não existir

    // Se código foi alterado, verificar unicidade
    if (obraData.codigo) {
      const existente = await obraRepository.findByCodigo(obraData.codigo);
      if (existente && Number(existente.id) !== Number(obraId)) {
        throw new ValidationError("Já existe outra obra com este código");
      }
    }

    // Não atualizar encarregados aqui — use addEncarregado/removeEncarregado
    const { encarregados, ...dadosObra } = obraData;

    await obraRepository.update(obraId, dadosObra);
    return await this._hydrate(obraId);
  }

  /**
   * Remove uma obra (soft delete). Apenas ADMIN.
   */
  async delete(obraId, userId, userPerfil) {
    if (userPerfil !== PERFIS.ADMIN) {
      throw new ForbiddenError("Apenas administradores podem remover obras");
    }

    const obra = await obraRepository.findById(obraId);
    const meta = this._parseMeta(obra.metadata);
    meta.deletedAt = new Date();
    meta.deletedBy = userId;

    try {
      await obraRepository.update(obraId, { metadata: JSON.stringify(meta) });
    } catch (err) {
      // BaseRepository.update() chama findById() ao final para retornar o registro
      // atualizado. Após o soft delete, findById() aplica _applyNotDeleted() e não
      // encontra mais a obra (agora filtrada como deletada), lançando NotFoundError.
      // Esse erro é esperado e indica sucesso — a gravação do deletedAt foi concluída.
      if (!(err instanceof NotFoundError)) throw err;
    }

    return { message: "Obra removida com sucesso" };
  }

  /**
   * Retorna uma obra pelo ID com lista de encarregados.
   */
  async getById(obraId, userId, userPerfil) {
    const obra = await obraRepository.findById(obraId);

    // Encarregado só pode ver obra à qual está vinculado
    if (userPerfil === PERFIS.ENCARREGADO) {
      const vinculado = await obraRepository.isEncarregadoVinculado(
        obraId,
        userId,
      );
      if (!vinculado) {
        throw new ForbiddenError("Você não tem acesso a esta obra");
      }
    }

    return await this._hydrate(obraId);
  }

  /**
   * Lista obras com paginação e filtros.
   * Encarregado vê apenas as obras às quais está vinculado.
   */
  async list(filters, options, userId, userPerfil) {
    if (userPerfil === PERFIS.ENCARREGADO) {
      return await obraRepository.findByEncarregado(userId, {
        ...options,
        status: filters.status,
      });
    }

    const filter = {};
    if (filters.status) filter.status = filters.status;
    if (filters.responsavel) filter.responsavel = filters.responsavel;

    const result = await obraRepository.findAll(filter, options);

    // Hidratar encarregados em lote (uma única query ao invés de N queries)
    const obraIds = result.data.map((o) => o.id);
    const encMap = await obraRepository.listarEncarregadosBatch(obraIds);
    const data = result.data.map((o) => ({ ...o, encarregados: encMap[o.id] || [] }));
    return { ...result, data };
  }

  /**
   * Vincula encarregado a obra. Apenas ADMIN.
   * A função (funcao) é sempre derivada do perfil do usuário no sistema.
   */
  async vincularEncarregado(obraId, userId, _funcao, adminPerfil) {
    if (adminPerfil !== PERFIS.ADMIN) {
      throw new ForbiddenError(
        "Apenas administradores podem vincular encarregados",
      );
    }

    // Verificar se usuário existe e obter seu perfil
    const user = await userRepository.findById(userId);

    // Funcao sempre reflete o perfil real do usuário no sistema
    const funcao = user.perfil;

    await obraRepository.vincularEncarregado(obraId, userId, funcao);
    return await this._hydrate(obraId);
  }

  /**
   * Lista usuários disponíveis para vincular como encarregados (ainda não vinculados à obra).
   * Apenas ADMIN.
   */
  async listarEncarregadosDisponiveis(obraId, adminPerfil) {
    if (adminPerfil !== PERFIS.ADMIN) {
      throw new ForbiddenError(
        "Apenas administradores podem listar encarregados disponíveis",
      );
    }

    await obraRepository.findById(obraId); // lança NotFoundError se obra não existir
    return await obraRepository.listarDisponiveisParaObra(obraId);
  }

  /**
   * Desvincula encarregado de obra. Apenas ADMIN.
   */
  async desvincularEncarregado(obraId, userId, adminPerfil) {
    if (adminPerfil !== PERFIS.ADMIN) {
      throw new ForbiddenError(
        "Apenas administradores podem desvincular encarregados",
      );
    }

    await obraRepository.desvincularEncarregado(obraId, userId);
    return await this._hydrate(obraId);
  }

  // ── helpers privados ─────────────────────────────────────────────────────

  async _hydrate(obraId) {
    const obra = await obraRepository.findById(obraId);
    return await this._appendEncarregados(obra);
  }

  async _appendEncarregados(obra) {
    obra.encarregados = await obraRepository.listarEncarregados(obra.id);
    return obra;
  }

  _parseMeta(metadata) {
    if (!metadata) return {};
    if (typeof metadata === "object") return metadata;
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }
}

module.exports = new ObraService();
