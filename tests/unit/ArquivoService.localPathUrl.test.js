const path = require("path");

const mockStorageIsSupabase = jest.fn();
const mockRepoCreate = jest.fn();

jest.mock("../../src/services/StorageService", () => ({
  isSupabase: mockStorageIsSupabase,
  upload: jest.fn(),
  getSignedUrl: jest.fn(),
  delete: jest.fn(),
}));

jest.mock("../../src/repositories/ArquivoRepository", () => ({
  create: mockRepoCreate,
  findById: jest.fn(),
  findByObra: jest.fn(),
  findByTipo: jest.fn(),
  findAll: jest.fn(),
  deleteWithFile: jest.fn(),
  getStorageUsage: jest.fn(),
}));

jest.mock("../../src/utils/fileTypeValidator", () => ({
  validateBuffer: jest.fn().mockReturnValue(true),
  validateFile: jest.fn().mockResolvedValue(true),
}));

const arquivoService = require("../../src/services/ArquivoService");

describe("ArquivoService local URL path", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageIsSupabase.mockReturnValue(false);
    mockRepoCreate.mockImplementation(async (payload) => ({ id: 1, ...payload }));
  });

  test("usa a subpasta real salva pelo multer ao montar URL /api/files/raw", async () => {
    const uploadRoot = path.resolve(process.env.UPLOAD_PATH || "./uploads");
    const file = {
      path: path.join(uploadRoot, "foto_obra", "arquivo-123.pdf"),
      filename: "arquivo-123.pdf",
      originalname: "NF.pdf",
      mimetype: "application/pdf",
      size: 2048,
    };

    const result = await arquivoService.processUpload(
      file,
      {
        obra: 1,
        tipo: "fotos",
        tipoArquivo: "foto_obra",
        descricao: "Arquivo local",
      },
      10,
    );

    expect(result.url).toBe("/api/files/raw/foto_obra/arquivo-123.pdf");
    expect(result.nome).toBe("arquivo-123.pdf");
    expect(mockRepoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/files/raw/foto_obra/arquivo-123.pdf",
        nome: "arquivo-123.pdf",
        tipo: "fotos",
        tipoArquivo: "foto_obra",
      }),
    );
  });
});
