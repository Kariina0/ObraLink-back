const diarioService = require("../services/DiarioService");
const DiarioDTO = require("../dtos/DiarioDTO");
const { successResponse, paginate } = require("../utils/helpers");
const { asyncHandler } = require("../middleware/errorHandler");

class DiarioController {
  create = asyncHandler(async (req, res) => {
    const result = await diarioService.create(req.body, req.user.id, req.user.perfil);
    const statusCode = result.merged ? 200 : 201;
    const message = result.merged
      ? "Diário do dia atualizado com sucesso"
      : "Diário criado com sucesso";

    res.status(statusCode).json(successResponse(new DiarioDTO(result.diario), message));
  });

  getAll = asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const result = await diarioService.getAll({ page, limit }, req.user.perfil);
    const { pagination } = paginate(page, limit, result.total);

    res.json(
      successResponse(
        result.data.map((d) => new DiarioDTO(d)),
        "Diários listados",
        pagination,
      ),
    );
  });

  getMinhas = asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const result = await diarioService.getMinhas(req.user.id, { page, limit });
    const { pagination } = paginate(page, limit, result.total);

    res.json(
      successResponse(
        result.data.map((d) => new DiarioDTO(d)),
        "Diários listados",
        pagination,
      ),
    );
  });

  getByObra = asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const result = await diarioService.getByObra(
      req.params.obraId,
      { page, limit },
      req.user.id,
      req.user.perfil,
    );
    const { pagination } = paginate(page, limit, result.total);

    res.json(
      successResponse(
        result.data.map((d) => new DiarioDTO(d)),
        "Diários listados",
        pagination,
      ),
    );
  });

  getById = asyncHandler(async (req, res) => {
    const diario = await diarioService.getById(req.params.id, req.user.id, req.user.perfil);
    res.json(successResponse(new DiarioDTO(diario), "Diário encontrado"));
  });

  update = asyncHandler(async (req, res) => {
    const diario = await diarioService.update(req.params.id, req.body, req.user.id, req.user.perfil);
    res.json(successResponse(new DiarioDTO(diario), "Diário atualizado com sucesso"));
  });

  delete = asyncHandler(async (req, res) => {
    await diarioService.delete(req.params.id, req.user.id, req.user.perfil);
    res.json(successResponse(null, "Diário excluído com sucesso"));
  });
}

module.exports = new DiarioController();
