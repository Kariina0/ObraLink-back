const express = require("express");
const router = express.Router();
const Joi = require("joi");
const solicitacaoRepository = require("../repositories/SolicitacaoCompraRepository");
const { authenticate, authorize } = require("../middleware/auth");
const { successResponse } = require("../utils/helpers");
const { asyncHandler } = require("../middleware/errorHandler");
const { ValidationError } = require("../utils/errors");
const { PERFIS } = require("../constants");

// ── Schemas de validação ──────────────────────────────────────────────────────

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

// ── Todas as rotas exigem autenticação ────────────────────────────────────────
router.use(authenticate);

/**
 * @route POST /api/solicitacoes
 * @desc Criar nova solicitação de compra
 * @access Private
 */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { error, value } = createSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join("."),
        message: d.message,
      }));
      throw new ValidationError("Dados inválidos", details);
    }

    const solicitacao = await solicitacaoRepository.create({
      ...value,
      itens: JSON.stringify(value.itens),
      solicitante: req.user.id,
      status: "pendente",
      dataSolicitacao: new Date(),
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
    const { page = 1, limit = 20, status } = req.query;
    const opts = { page: parseInt(page), limit: parseInt(limit) };

    let result;
    if (req.user.perfil === PERFIS.ENCARREGADO) {
      const filter = { solicitante: req.user.id };
      if (status) filter.status = status;
      result = await solicitacaoRepository.findAll(filter, opts);
    } else {
      const filter = {};
      if (status) filter.status = status;
      result = await solicitacaoRepository.findAll(filter, opts);
    }

    res.json(successResponse(result, "Solicitações listadas"));
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
    const solicitacao = await solicitacaoRepository.findById(
      parseInt(req.params.id, 10)
    );

    if (
      req.user.perfil === PERFIS.ENCARREGADO &&
      Number(solicitacao.solicitante) !== Number(req.user.id)
    ) {
      const { ForbiddenError } = require("../utils/errors");
      throw new ForbiddenError("Você não tem permissão para acessar esta solicitação");
    }

    res.json(successResponse(solicitacao, "Solicitação encontrada"));
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
    const solicitacao = await solicitacaoRepository.aprovar(
      parseInt(req.params.id, 10),
      req.user.id
    );
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
  asyncHandler(async (req, res) => {
    const { error, value } = updateStatusSchema.validate(req.body, {
      stripUnknown: true,
    });
    if (error) throw new ValidationError(error.details[0].message);

    const solicitacao = await solicitacaoRepository.rejeitar(
      parseInt(req.params.id, 10),
      value.motivoRejeicao || null,
      req.user.id
    );
    res.json(
      successResponse(solicitacao, "Solicitação rejeitada com sucesso")
    );
  })
);

module.exports = router;