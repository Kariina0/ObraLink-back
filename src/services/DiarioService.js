const diarioRepository = require("../repositories/DiarioRepository");
const obraRepository = require("../repositories/ObraRepository");
const { ForbiddenError, NotFoundError, ConflictError } = require("../utils/errors");
const { generateSyncId } = require("../utils/helpers");
const { PERFIS } = require("../constants");

class DiarioService {
  async create(diarioData, userId, userPerfil) {
    await this._validateObra(diarioData.obra);
    await this._ensureObraPermission(diarioData.obra, userId, userPerfil);

    const targetDate = diarioData.data || new Date();
    const targetDay = this._extractDay(targetDate);
    const existingByOwner = await diarioRepository.findAll(
      { obra: diarioData.obra },
      { limit: 10000 },
    );
    const existing = existingByOwner.data.find((d) => this._extractDay(d.data) === targetDay) || null;

    if (existing) {
      if (
        userPerfil === PERFIS.ENCARREGADO &&
        Number(existing.responsavel) !== Number(userId)
      ) {
        throw new ForbiddenError("Você não pode atualizar diário de outro responsável");
      }

      const merged = this._mergeExistingWithIncoming(existing, diarioData);
      merged.metadata = JSON.stringify({
        updatedBy: userId,
        updatedAt: new Date(),
      });

      const updated = await diarioRepository.update(existing.id, merged);
      return { diario: updated, merged: true };
    }

    const payload = this._serializePayload(diarioData);
    payload.responsavel = userId;
    payload.syncId = payload.syncId || generateSyncId();
    payload.metadata = JSON.stringify({ createdBy: userId });

    const created = await diarioRepository.create(payload);
    return { diario: created, merged: false };
  }

  async update(diarioId, diarioData, userId, userPerfil) {
    const diario = await diarioRepository.findById(diarioId);
    this._ensureRecordPermission(diario, userId, userPerfil);

    const targetObra = diarioData.obra || diario.obra;
    const targetDate = diarioData.data || diario.data;

    if (targetObra && targetDate) {
      const sameDay = await diarioRepository.findByData(targetObra, targetDate);
      if (sameDay && Number(sameDay.id) !== Number(diario.id)) {
        throw new ConflictError("Já existe diário para esta obra nesta data");
      }
    }

    const payload = this._serializePayload(diarioData);
    payload.metadata = JSON.stringify({ updatedBy: userId, updatedAt: new Date() });

    return await diarioRepository.update(diarioId, payload);
  }

  async getById(diarioId, userId, userPerfil) {
    const diario = await diarioRepository.findById(diarioId);
    this._ensureRecordPermission(diario, userId, userPerfil, true);
    return diario;
  }

  async getByObra(obraId, options, userId, userPerfil) {
    if (userPerfil === PERFIS.ENCARREGADO) {
      const vinculado = await obraRepository.isEncarregadoVinculado(obraId, userId);
      if (!vinculado) {
        throw new ForbiddenError("Você não tem permissão para acessar diários desta obra");
      }
      return await diarioRepository.findAll({ obra: Number(obraId), responsavel: userId }, options);
    }
    return await diarioRepository.findByObra(obraId, options);
  }

  async getMinhas(userId, options = {}) {
    return await diarioRepository.findAll({ responsavel: userId }, options);
  }

  async getAll(options, userPerfil) {
    if (![PERFIS.ADMIN, PERFIS.SUPERVISOR].includes(userPerfil)) {
      throw new ForbiddenError("Apenas supervisores e administradores podem listar todos os diários");
    }
    return await diarioRepository.findAll({}, options);
  }

  async delete(diarioId, userId, userPerfil) {
    const diario = await diarioRepository.findById(diarioId);
    this._ensureRecordPermission(diario, userId, userPerfil);
    return await diarioRepository.delete(diarioId);
  }

  async _validateObra(obraId) {
    const obra = await obraRepository.findById(obraId);
    if (!obra) throw new NotFoundError("Obra não encontrada");
  }

  async _ensureObraPermission(obraId, userId, userPerfil) {
    if (userPerfil !== PERFIS.ENCARREGADO) return;
    const vinculado = await obraRepository.isEncarregadoVinculado(obraId, userId);
    if (!vinculado) {
      throw new ForbiddenError("Você não está vinculado a esta obra");
    }
  }

  _ensureRecordPermission(diario, userId, userPerfil, readOnly = false) {
    if ([PERFIS.ADMIN, PERFIS.SUPERVISOR].includes(userPerfil)) return;
    if (Number(diario.responsavel) !== Number(userId)) {
      const message = readOnly
        ? "Você não tem permissão para acessar este diário"
        : "Você não tem permissão para alterar este diário";
      throw new ForbiddenError(message);
    }
  }

  _mergeExistingWithIncoming(existing, incoming) {
    const merged = {};

    merged.clima = incoming.clima !== undefined ? incoming.clima : existing.clima;
    merged.observacoesGerais = incoming.observacoesGerais !== undefined
      ? incoming.observacoesGerais
      : existing.observacoesGerais;
    merged.assinatura = incoming.assinatura !== undefined ? incoming.assinatura : existing.assinatura;

    merged.equipamentos = this._mergeJsonValue(existing.equipamentos, incoming.equipamentos);
    merged.maoDeObra = this._mergeJsonValue(existing.maoDeObra, incoming.maoDeObra);
    merged.atividades = this._mergeJsonValue(existing.atividades, incoming.atividades);
    merged.materiais = this._mergeJsonValue(existing.materiais, incoming.materiais);
    merged.ocorrencias = this._mergeArrayValue(existing.ocorrencias, incoming.ocorrencias);
    merged.visitantes = this._mergeArrayValue(existing.visitantes, incoming.visitantes);
    merged.fotos = this._mergeArrayValue(existing.fotos, incoming.fotos);

    if (incoming.clientTimestamp) merged.clientTimestamp = incoming.clientTimestamp;
    if (incoming.sincronizado !== undefined) merged.sincronizado = incoming.sincronizado;

    return this._serializePayload(merged);
  }

  _mergeJsonValue(existing, incoming) {
    if (incoming === undefined) return existing;
    const existingParsed = this._safeParse(existing);
    if (Array.isArray(existingParsed) && Array.isArray(incoming)) {
      return [...existingParsed, ...incoming];
    }
    if (
      existingParsed &&
      typeof existingParsed === "object" &&
      !Array.isArray(existingParsed) &&
      incoming &&
      typeof incoming === "object" &&
      !Array.isArray(incoming)
    ) {
      return { ...existingParsed, ...incoming };
    }
    return incoming;
  }

  _mergeArrayValue(existing, incoming) {
    if (incoming === undefined) return existing;
    const existingArr = this._safeParse(existing, []);
    return [...(Array.isArray(existingArr) ? existingArr : []), ...(Array.isArray(incoming) ? incoming : [])];
  }

  _serializePayload(data) {
    const payload = { ...data };
    const jsonFields = ["equipamentos", "maoDeObra", "atividades", "materiais", "ocorrencias", "visitantes", "fotos"];

    jsonFields.forEach((field) => {
      if (payload[field] !== undefined && payload[field] !== null && typeof payload[field] !== "string") {
        payload[field] = JSON.stringify(payload[field]);
      }
    });

    return payload;
  }

  _safeParse(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  _extractDay(value) {
    if (!value) return null;
    const raw = String(value);
    const match = raw.match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];

    const dt = new Date(value);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  }
}

module.exports = new DiarioService();
