const obraService = require("../services/ObraService");
const ObraDTO = require("../dtos/ObraDTO");
const { successResponse, paginate } = require("../utils/helpers");
const { asyncHandler } = require("../middleware/errorHandler");

class ObraController {
  /**
   * @route GET /api/obras
   * @desc Listar obras (encarregado vê apenas as suas)
   * @access Private
   */
  list = asyncHandler(async (req, res) => {
    const rawPage  = parseInt(req.query.page,  10);
    const rawLimit = parseInt(req.query.limit, 10);
    const page  = rawPage  > 0  ? rawPage  : 1;
    const limit = rawLimit > 0 && rawLimit <= 100 ? rawLimit : 20;
    const options = { page, limit };
    const filters = { status: req.query.status, responsavel: req.query.responsavel };

    const result = await obraService.list(filters, options, req.user.id, req.user.perfil);
    const { pagination } = paginate(page, limit, result.total);

    res.json(
      successResponse(
        result.data.map((o) => new ObraDTO(o)),
        "Lista de obras",
        pagination,
      ),
    );
  });

  /**
   * @route GET /api/obras/:id
   * @desc Obter obra por ID
   * @access Private
   */
  getById = asyncHandler(async (req, res) => {
    const obra = await obraService.getById(req.params.id, req.user.id, req.user.perfil);
    res.json(successResponse(new ObraDTO(obra), "Obra encontrada"));
  });

  /**
   * @route POST /api/obras
   * @desc Criar nova obra
   * @access Admin
   */
  create = asyncHandler(async (req, res) => {
    const obra = await obraService.create(req.body, req.user.id, req.user.perfil);
    res.status(201).json(successResponse(new ObraDTO(obra), "Obra criada com sucesso"));
  });

  /**
   * @route PUT /api/obras/:id
   * @desc Atualizar obra
   * @access Admin
   */
  update = asyncHandler(async (req, res) => {
    const obra = await obraService.update(req.params.id, req.body, req.user.perfil);
    res.json(successResponse(new ObraDTO(obra), "Obra atualizada com sucesso"));
  });

  /**
   * @route DELETE /api/obras/:id
   * @desc Remover obra (soft delete)
   * @access Admin
   */
  delete = asyncHandler(async (req, res) => {
    const result = await obraService.delete(req.params.id, req.user.id, req.user.perfil);
    res.json(successResponse(null, result.message));
  });

  /**
   * @route POST /api/obras/:id/encarregados
   * @desc Vincular encarregado a uma obra
   * @access Admin
   */
  vincularEncarregado = asyncHandler(async (req, res) => {
    const { userId, funcao } = req.body;
    const obra = await obraService.vincularEncarregado(
      req.params.id,
      userId,
      funcao,
      req.user.perfil,
    );
    res.status(201).json(successResponse(new ObraDTO(obra), "Encarregado vinculado com sucesso"));
  });

  /**
   * @route DELETE /api/obras/:id/encarregados/:userId
   * @desc Desvincular encarregado de uma obra
   * @access Admin
   */
  desvincularEncarregado = asyncHandler(async (req, res) => {
    const obra = await obraService.desvincularEncarregado(
      req.params.id,
      req.params.userId,
      req.user.perfil,
    );
    res.json(successResponse(new ObraDTO(obra), "Encarregado desvinculado com sucesso"));
  });
}

module.exports = new ObraController();

