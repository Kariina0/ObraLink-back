const express = require("express");
const router = express.Router();
const Joi = require("joi");
const solicitacaoRepository = require("../repositories/SolicitacaoCompraRepository");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const { successResponse } = require("../utils/helpers");
const { asyncHandler } = require("../middleware/errorHandler");
const { ValidationError, ForbiddenError } = require("../utils/errors");
const { PERFIS } = require("../constants");

// ── Schemas de validação ──────────────────────────────────────────────────────

const { generateSyncId } = require("../utils/helpers");

const createSchema = Joi.object({
  obra: Joi.number().integer().positive().allow(null).default(null),
  itens: Joi.array()
    .items(
      Joi.object({
        descricao: Joi.string().required().trim(),
        quantidade: Joi.number().min(0).required(),
        unidade: Joi.string().required(),
        valorUnitario: Joi.number().min(0).allow(null),
        observacoes: Joi.string().allow("", null),
      })
    )
    .min(1)
    .required()
    .messages({ "array.min": "Pelo menos um item é obrigatório" }),
  prioridade: Joi.string()
    .valid("baixa", "media", "alta", "urgente")
    .default("media"),
  dataNecessidade: Joi.date().allow(null).default(null),
  justificativa: Joi.string().allow("", null).default(null),
  observacoes: Joi.string().allow("", null).default(null),
});

const updateStatusSchema = Joi.object({
  motivoRejeicao: Joi.string().allow("", null),
});

// ── Helper: desserializa o campo itens (armazenado como JSON string) ─────────
const deserializeItens = (s) => ({
  ...s,
  itens: (() => {
    if (Array.isArray(s.itens)) return s.itens;
    if (typeof s.itens === "string") {
      try { return JSON.parse(s.itens); } catch (_) { return []; }
    }
    return [];
  })(),
});

// ── Todas as rotas exigem autenticação ────────────────────────────────────────
router.use(authenticate);

/**
 * @route POST /api/solicitacoes
 * @desc Criar nova solicitação de compra
 * @access Private
 */
router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    // Calcular valorTotal a partir dos itens para permitir queries de soma no management
    const itens = req.body.itens || [];
    const valorTotal = itens.reduce((acc, item) => {
      const qty = Number(item.quantidade) || 0;
      const price = Number(item.valorUnitario) || 0;
      return acc + qty * price;
    }, 0);

    const solicitacao = await solicitacaoRepository.create({
      ...req.body,
      itens: JSON.stringify(req.body.itens),
      valorTotal,
      solicitante: req.user.id,
      status: "pendente",
      dataSolicitacao: new Date(),
      syncId: generateSyncId(),
    });

    res
      .status(201)
      .json(successResponse(solicitacao, "Solicitação criada com sucesso"));
  })
);

/**
 * @route GET /api/solicitacoes
 * @desc Listar solicitações (encarregado vê apenas as próprias)
 * @access Private
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const { status } = req.query;
    const opts = { page, limit };

    const filter = {};
    if (req.user.perfil === PERFIS.ENCARREGADO) {
      filter.solicitante = req.user.id;
    }
    if (status) filter.status = status;

    const result = await solicitacaoRepository.findAll(filter, opts);
    const deserializedResult = {
      ...result,
      data: Array.isArray(result.data) ? result.data.map(deserializeItens) : result.data,
    };
    res.json(successResponse(deserializedResult, "Solicitações listadas"));
  })
);

/**
 * @route GET /api/solicitacoes/:id
 * @desc Obter solicitação por ID
 * @access Private
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) throw new ValidationError("ID inválido");

    const solicitacao = await solicitacaoRepository.findById(id);

    if (
      req.user.perfil === PERFIS.ENCARREGADO &&
      Number(solicitacao.solicitante) !== Number(req.user.id)
    ) {
      throw new ForbiddenError("Você não tem permissão para acessar esta solicitação");
    }

    res.json(successResponse(deserializeItens(solicitacao), "Solicitação encontrada"));
  })
);

/**
 * @route POST /api/solicitacoes/:id/aprovar
 * @desc Aprovar solicitação
 * @access Supervisor, Admin
 */
router.post(
  "/:id/aprovar",
  authorize(PERFIS.SUPERVISOR, PERFIS.ADMIN),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) throw new ValidationError("ID inválido");

    const solicitacao = await solicitacaoRepository.aprovar(id, req.user.id);
    res.json(successResponse(solicitacao, "Solicitação aprovada com sucesso"));
  })
);

/**
 * @route POST /api/solicitacoes/:id/rejeitar
 * @desc Rejeitar solicitação
 * @access Supervisor, Admin
 */
router.post(
  "/:id/rejeitar",
  authorize(PERFIS.SUPERVISOR, PERFIS.ADMIN),
  validate(updateStatusSchema),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) throw new ValidationError("ID inválido");

    const solicitacao = await solicitacaoRepository.rejeitar(
      id,
      req.body.motivoRejeicao || null,
      req.user.id
    );
    res.json(successResponse(solicitacao, "Solicitação rejeitada com sucesso"));
  })
);

module.exports = router;