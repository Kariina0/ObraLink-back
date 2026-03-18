const arquivoService = require("../services/ArquivoService");
const ArquivoDTO = require("../dtos/ArquivoDTO");
const {
  successResponse,
  paginate,
  toAbsoluteUrl,
} = require("../utils/helpers");
const { asyncHandler } = require("../middleware/errorHandler");

class ArquivoController {
  _toArquivoDTO(req, arquivo) {
    return new ArquivoDTO({
      ...arquivo,
      url: toAbsoluteUrl(req, arquivo?.url),
      storage_url: toAbsoluteUrl(req, arquivo?.storage_url),
    });
  }

  /**
   * @route POST /api/files/upload
   * @desc Upload de arquivo único
   * @access Private
   */
  upload = asyncHandler(async (req, res) => {
    if (!req.file) {
      const { ValidationError } = require("../utils/errors");
      throw new ValidationError("Nenhum arquivo fornecido");
    }

    const arquivo = await arquivoService.processUpload(
      req.file,
      req.body,
      req.user.id,
    );

    res
      .status(201)
      .json(
        successResponse(
          this._toArquivoDTO(req, arquivo),
          "Arquivo enviado com sucesso",
        ),
      );
  });

  /**
   * @route POST /api/files/upload-multiple
   * @desc Upload de múltiplos arquivos
   * @access Private
   */
  uploadMultiple = asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      const { ValidationError } = require("../utils/errors");
      throw new ValidationError("Nenhum arquivo fornecido");
    }

    const results = await arquivoService.processMultipleUploads(
      req.files,
      req.body,
      req.user.id,
    );

    const successful = results
      .filter((r) => r.success)
      .map((r) => this._toArquivoDTO(req, r.arquivo));
    const failed = results.filter((r) => !r.success);

    res.status(201).json(
      successResponse(
        {
          uploaded: successful,
          failed,
        },
        `${successful.length} arquivo(s) enviado(s) com sucesso`,
      ),
    );
  });

  /**
   * @route GET /api/files/:id
   * @desc Obter arquivo por ID
   * @access Private
   */
  getById = asyncHandler(async (req, res) => {
    const arquivo = await arquivoService.getById(
      req.params.id,
      req.user.id,
      req.user.perfil,
    );

    res.json(
      successResponse(this._toArquivoDTO(req, arquivo), "Arquivo encontrado"),
    );
  });

  /**
   * @route GET /api/files/obra/:obraId
   * @desc Listar arquivos de uma obra
   * @access Private
   */
  getByObra = asyncHandler(async (req, res) => {
    const rawPage = parseInt(req.query.page, 10);
    const rawLimit = parseInt(req.query.limit, 10);
    const page = rawPage > 0 ? rawPage : 1;
    const limit = rawLimit > 0 && rawLimit <= 100 ? rawLimit : 20;
    const result = await arquivoService.getByObra(
      req.params.obraId,
      {
        page,
        limit,
      },
      req.user.id,
      req.user.perfil,
    );

    const { pagination } = paginate(page, limit, result.total);

    res.json(
      successResponse(
        result.data.map((a) => this._toArquivoDTO(req, a)),
        "Arquivos listados",
        pagination,
      ),
    );
  });

  /**
   * @route GET /api/files/tipo/:tipo
   * @desc Listar arquivos por tipo
   * @access Private
   */
  getByTipo = asyncHandler(async (req, res) => {
    const rawPage = parseInt(req.query.page, 10);
    const rawLimit = parseInt(req.query.limit, 10);
    const page = rawPage > 0 ? rawPage : 1;
    const limit = rawLimit > 0 && rawLimit <= 100 ? rawLimit : 20;
    const result = await arquivoService.getByTipo(
      req.params.tipo,
      {
        page,
        limit,
      },
      req.user.id,
      req.user.perfil,
    );

    const { pagination } = paginate(page, limit, result.total);

    res.json(
      successResponse(
        result.data.map((a) => this._toArquivoDTO(req, a)),
        "Arquivos listados",
        pagination,
      ),
    );
  });

  /**
   * @route DELETE /api/files/:id
   * @desc Excluir arquivo
   * @access Private
   */
  delete = asyncHandler(async (req, res) => {
    await arquivoService.delete(req.params.id, req.user.id, req.user.perfil);

    res.json(successResponse(null, "Arquivo excluído com sucesso"));
  });

  /**
   * @route GET /api/files/storage/usage
   * @desc Obter uso de armazenamento
   * @access Admin
   */
  getStorageUsage = asyncHandler(async (req, res) => {
    const { obraId } = req.query;
    const usage = await arquivoService.getStorageUsage(obraId);

    res.json(
      successResponse(
        {
          totalSize: usage.totalSize,
          totalFiles: usage.totalFiles,
          totalSizeMB: (usage.totalSize / (1024 * 1024)).toFixed(2),
        },
        "Uso de armazenamento",
      ),
    );
  });
}

module.exports = new ArquivoController();
