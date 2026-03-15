const diarioService = require("../services/DiarioService");
const DiarioDTO     = require("../dtos/DiarioDTO");
const { successResponse, paginate } = require("../utils/helpers");
const { asyncHandler } = require("../middleware/errorHandler");

class DiarioController {
  /**
   * @route POST /api/diarios
   * @desc Criar novo registro de Diário de Obra
   * @access Encarregado, Supervisor, Admin
   */
  create = asyncHandler(async (req, res) => {
    const diario = await diarioService.create(
      req.body,
      req.user.id,
      req.user.perfil,
    );

    res.status(201).json(
      successResponse(new DiarioDTO(diario), "Diário registrado com sucesso"),
    );
  });

  /**
   * @route GET /api/diarios/minhas
   * @desc Listar diários do usuário logado
   * @access Private
   */
  getMinhas = asyncHandler(async (req, res) => {
    const rawPage  = parseInt(req.query.page, 10);
    const rawLimit = parseInt(req.query.limit, 10);
    const page  = rawPage  > 0 ? rawPage  : 1;
    const limit = rawLimit > 0 && rawLimit <= 100 ? rawLimit : 10;
    const result = await diarioService.getByResponsavel(req.user.id, {
      page,
      limit,
    });

    const { pagination } = paginate(page, limit, result.total);

    res.json(
      successResponse(
        result.data.map((d) => new DiarioDTO(d)),
        "Diários listados",
        pagination,
      ),
    );
  });

  /**
   * @route GET /api/diarios
   * @desc Listar todos os diários (supervisor/admin)
   * @access Supervisor, Admin
   */
  getAll = asyncHandler(async (req, res) => {
    const rawPage  = parseInt(req.query.page, 10);
    const rawLimit = parseInt(req.query.limit, 10);
    const page  = rawPage  > 0 ? rawPage  : 1;
    const limit = rawLimit > 0 && rawLimit <= 100 ? rawLimit : 10;
    const { obra } = req.query;
    const result = await diarioService.getAll({ page, limit, obra });

    const { pagination } = paginate(page, limit, result.total);

    res.json(
      successResponse(
        result.data.map((d) => new DiarioDTO(d)),
        "Diários listados",
        pagination,
      ),
    );
  });

  /**
   * @route GET /api/diarios/:id
   * @desc Obter diário por ID
   * @access Private
   */
  getById = asyncHandler(async (req, res) => {
    const diario = await diarioService.getById(
      req.params.id,
      req.user.id,
      req.user.perfil,
    );

    res.json(successResponse(new DiarioDTO(diario), "Diário encontrado"));
  });

  /**
   * @route PUT /api/diarios/:id
   * @desc Atualizar diário
   * @access Private
   */
  update = asyncHandler(async (req, res) => {
    const diario = await diarioService.update(
      req.params.id,
      req.body,
      req.user.id,
      req.user.perfil,
    );

    res.json(successResponse(new DiarioDTO(diario), "Diário atualizado com sucesso"));
  });

  /**
   * @route DELETE /api/diarios/:id
   * @desc Remover diário (soft delete)
   * @access Private
   */
  delete = asyncHandler(async (req, res) => {
    await diarioService.delete(req.params.id, req.user.id, req.user.perfil);
    res.json(successResponse(null, "Diário removido com sucesso"));
  });
}

module.exports = new DiarioController();
