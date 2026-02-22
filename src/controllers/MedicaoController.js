const medicaoService = require("../services/MedicaoService");
const MedicaoDTO = require("../dtos/MedicaoDTO");
const { successResponse, paginate } = require("../utils/helpers");
const { asyncHandler } = require("../middleware/errorHandler");

class MedicaoController {
  /**
   * @route POST /api/measurements
   * @desc Criar nova medição
   * @access Encarregado, Supervisor, Admin
   */
  create = asyncHandler(async (req, res) => {
    const medicao = await medicaoService.create(req.body, req.user.id);

    res.status(201).json(
      successResponse(new MedicaoDTO(medicao), "Medição criada com sucesso")
    );
  });

  /**
   * @route GET /api/measurements/:id
   * @desc Obter medição por ID
   * @access Private
   */
  getById = asyncHandler(async (req, res) => {
    const medicao = await medicaoService.getById(req.params.id);

    res.json(successResponse(new MedicaoDTO(medicao), "Medição encontrada"));
  });

  /**
   * @route GET /api/measurements/obra/:obraId
   * @desc Listar medições de uma obra
   * @access Private
   */
  getByObra = asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const result = await medicaoService.getByObra(req.params.obraId, { page, limit });

    const { pagination } = paginate(page, limit, result.total);

    res.json(
      successResponse(
        result.data.map((m) => new MedicaoDTO(m)),
        "Medições listadas",
        pagination
      )
    );
  });

  /**
   * @route GET /api/measurements/minhas
   * @desc Listar medições do usuário atual
   * @access Private
   */
  getMinhas = asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const result = await medicaoService.getByResponsavel(req.user.id, { page, limit });

    const { pagination } = paginate(page, limit, result.total);

    res.json(
      successResponse(
        result.data.map((m) => new MedicaoDTO(m)),
        "Medições listadas",
        pagination
      )
    );
  });

  /**
   * @route PUT /api/measurements/:id
   * @desc Atualizar medição
   * @access Private
   */
  update = asyncHandler(async (req, res) => {
    const medicao = await medicaoService.update(
      req.params.id,
      req.body,
      req.user.id,
      req.user.perfil
    );

    res.json(successResponse(new MedicaoDTO(medicao), "Medição atualizada com sucesso"));
  });

  /**
   * @route POST /api/measurements/:id/aprovar
   * @desc Aprovar medição
   * @access Supervisor, Admin
   */
  aprovar = asyncHandler(async (req, res) => {
    const medicao = await medicaoService.aprovar(
      req.params.id,
      req.user.id,
      req.user.perfil
    );

    res.json(successResponse(new MedicaoDTO(medicao), "Medição aprovada com sucesso"));
  });

  /**
   * @route POST /api/measurements/:id/rejeitar
   * @desc Rejeitar medição
   * @access Supervisor, Admin
   */
  rejeitar = asyncHandler(async (req, res) => {
    const medicao = await medicaoService.rejeitar(
      req.params.id,
      req.user.id,
      req.user.perfil
    );

    res.json(successResponse(new MedicaoDTO(medicao), "Medição rejeitada"));
  });

  /**
   * @route DELETE /api/measurements/:id
   * @desc Excluir medição (soft delete)
   * @access Private
   */
  delete = asyncHandler(async (req, res) => {
    await medicaoService.delete(req.params.id, req.user.id, req.user.perfil);

    res.json(successResponse(null, "Medição excluída com sucesso"));
  });
}

module.exports = new MedicaoController();
