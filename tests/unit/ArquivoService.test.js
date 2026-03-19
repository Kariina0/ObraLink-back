/**
 * Testes unitários — ArquivoService
 *
 * Cobre:
 *  - processUpload modo supabase (compressão em RAM + upload)
 *  - processUpload modo local    (arquivo em disco)
 *  - processMultipleUploads (sucesso e falha parcial)
 *  - getById com geração de signed URL
 *  - delete com remoção do Supabase antes do banco
 */

// ─── Mocks de dependências ────────────────────────────────────────────────────
const mockStorageUpload = jest.fn();
const mockStorageSignedUrl = jest.fn();
const mockStorageDelete = jest.fn();
const mockStorageIsSupabase = jest.fn();

jest.mock("../../src/services/StorageService", () => ({
  isSupabase: mockStorageIsSupabase,
  upload: mockStorageUpload,
  getSignedUrl: mockStorageSignedUrl,
  delete: mockStorageDelete,
}));

const mockRepoCreate = jest.fn();
const mockRepoFindById = jest.fn();
const mockRepoFindByObra = jest.fn();
const mockRepoFindByTipo = jest.fn();
const mockRepoDelete = jest.fn();
const mockRepoUsage = jest.fn();

jest.mock("../../src/repositories/ArquivoRepository", () => ({
  create: mockRepoCreate,
  findById: mockRepoFindById,
  findByObra: mockRepoFindByObra,
  findByTipo: mockRepoFindByTipo,
  deleteWithFile: mockRepoDelete,
  getStorageUsage: mockRepoUsage,
}));

// Sharp mock — simula compressão de imagem
jest.mock("sharp", () => {
  const mockMetadata = jest.fn().mockResolvedValue({ width: 800, height: 600 });
  const mockToBuffer = jest.fn().mockResolvedValue(Buffer.from("compressed"));
  const mockToFile = jest.fn().mockResolvedValue(undefined);
  const mockJpeg = jest.fn().mockReturnThis();

  const sharpInstance = {
    metadata: mockMetadata,
    jpeg: mockJpeg,
    toBuffer: mockToBuffer,
    toFile: mockToFile,
  };
  return jest.fn(() => sharpInstance);
});

// fs.promises mock para modo local
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  promises: {
    stat: jest.fn().mockResolvedValue({ size: 50000 }),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));

// ─── Instância de serviço (carregada após mocks) ──────────────────────────────
const arquivoService = require("../../src/services/ArquivoService");

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fakeSuapabaseResult = {
  storagePath: "fotos/uuid-abc.jpg",
  storageUrl: "https://supabase.co/signed/uuid-abc.jpg",
  provider: "supabase",
  filename: "uuid-abc.jpg",
};

const fakeArquivoDB = {
  id: 10,
  nome: "uuid-abc.jpg",
  nomeOriginal: "foto.jpg",
  tipo: "fotos",
  mimeType: "image/jpeg",
  tamanho: 50000,
  storage_provider: "supabase",
  storage_path: "fotos/uuid-abc.jpg",
  storage_url: "https://supabase.co/signed/uuid-abc.jpg",
  uploadedBy: 1,
};

// ─── beforeEach ───────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Buffers com magic bytes reais ───────────────────────────────────────────
// A validação C-3 inspeciona os primeiros bytes do buffer/arquivo.
// Sem magic bytes corretos o upload é rejeitado com ValidationError.

// JPEG: inicia com FF D8 FF E0
const jpegBuffer = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(20, 0x00),
]);

// PNG: inicia com 89 50 4E 47 0D 0A 1A 0A
const pngBuffer = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(20, 0x00),
]);

// PDF: inicia com %PDF (25 50 44 46)
const pdfBuffer = Buffer.concat([
  Buffer.from([0x25, 0x50, 0x44, 0x46]),
  Buffer.alloc(20, 0x00),
]);

// ─── SUITE: processUpload — modo Supabase ─────────────────────────────────────
describe("processUpload — modo supabase", () => {
  beforeEach(() => {
    mockStorageIsSupabase.mockReturnValue(true);
    mockStorageUpload.mockResolvedValue(fakeSuapabaseResult);
    mockRepoCreate.mockResolvedValue(fakeArquivoDB);
  });

  test("chama storageService.upload com buffer e salva no banco", async () => {
    const file = {
      buffer: jpegBuffer,
      size: 100000,
      mimetype: "image/jpeg",
      originalname: "foto.jpg",
    };
    const metadata = {
      obra: 5,
      tipo: "fotos",
      tipoArquivo: "foto_obra",
      descricao: "test",
    };

    const result = await arquivoService.processUpload(file, metadata, 1);

    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.any(Buffer), // buffer (possivelmente comprimido)
      "foto.jpg",
      "fotos",
      "image/jpeg",
    );
    expect(mockRepoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        storage_provider: "supabase",
        storage_path: "fotos/uuid-abc.jpg",
        nomeOriginal: "foto.jpg",
        obra: 5,
        uploadedBy: 1,
      }),
    );
    expect(result).toEqual(fakeArquivoDB);
  });

  test("funciona para arquivo não-imagem (PDF) sem compressão", async () => {
    const file = {
      buffer: pdfBuffer,
      size: 200000,
      mimetype: "application/pdf",
      originalname: "documento.pdf",
    };
    mockStorageUpload.mockResolvedValue({
      ...fakeSuapabaseResult,
      storagePath: "documentos/uuid-pdf.pdf",
      filename: "uuid-pdf.pdf",
    });

    await arquivoService.processUpload(
      file,
      {
        obra: 1,
        tipo: "documentos",
        tipoArquivo: "documento",
        descricao: "Documento de teste",
      },
      1,
    );

    expect(mockStorageUpload).toHaveBeenCalledWith(
      file.buffer,
      "documento.pdf",
      "documentos",
      "application/pdf",
    );
  });

  test("normaliza PNG comprimido para extensao e MIME JPEG no upload", async () => {
    const file = {
      buffer: pngBuffer,
      size: 100000,
      mimetype: "image/png",
      originalname: "foto.png",
    };
    const metadata = {
      obra: 5,
      tipo: "fotos",
      tipoArquivo: "foto_obra",
      descricao: "test",
    };

    await arquivoService.processUpload(file, metadata, 1);

    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.any(Buffer),
      "foto.jpg",
      "fotos",
      "image/jpeg",
    );
    expect(mockRepoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: "image/jpeg",
        nomeOriginal: "foto.png",
      }),
    );
  });
});

// ─── SUITE: processMultipleUploads ─────────────────────────────────────────────
describe("processMultipleUploads", () => {
  beforeEach(() => {
    mockStorageIsSupabase.mockReturnValue(true);
    mockRepoCreate.mockResolvedValue(fakeArquivoDB);
  });

  test("retorna resultados de sucesso para todos os arquivos enviados", async () => {
    mockStorageUpload.mockResolvedValue(fakeSuapabaseResult);

    const files = [
      {
        buffer: jpegBuffer,
        size: 100,
        mimetype: "image/jpeg",
        originalname: "a.jpg",
      },
      {
        buffer: jpegBuffer,
        size: 100,
        mimetype: "image/jpeg",
        originalname: "b.jpg",
      },
      {
        buffer: jpegBuffer,
        size: 100,
        mimetype: "image/jpeg",
        originalname: "c.jpg",
      },
    ];

    const results = await arquivoService.processMultipleUploads(
      files,
      {
        obra: 1,
        tipo: "fotos",
        tipoArquivo: "foto_obra",
        descricao: "Fotos da obra",
      },
      1,
    );

    expect(results).toHaveLength(3);
    results.forEach((r) => expect(r.success).toBe(true));
  });

  test("retorna falha parcial quando um upload falha", async () => {
    mockStorageUpload
      .mockResolvedValueOnce(fakeSuapabaseResult) // primeiro OK
      .mockRejectedValueOnce(new Error("timeout")) // segundo FALHA
      .mockResolvedValueOnce(fakeSuapabaseResult); // terceiro OK

    const files = [
      {
        buffer: jpegBuffer,
        size: 100,
        mimetype: "image/jpeg",
        originalname: "a.jpg",
      },
      {
        buffer: jpegBuffer,
        size: 100,
        mimetype: "image/jpeg",
        originalname: "b.jpg",
      },
      {
        buffer: jpegBuffer,
        size: 100,
        mimetype: "image/jpeg",
        originalname: "c.jpg",
      },
    ];

    const results = await arquivoService.processMultipleUploads(
      files,
      {
        obra: 1,
        tipo: "fotos",
        tipoArquivo: "foto_obra",
        descricao: "Fotos da obra",
      },
      1,
    );

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes).toHaveLength(2);
    expect(failures).toHaveLength(1);
    expect(failures[0].filename).toBe("b.jpg");
    expect(failures[0].error).toBe("timeout");
  });
});

// ─── SUITE: getById ───────────────────────────────────────────────────────────
describe("getById", () => {
  test("gera signed URL fresca quando arquivo está no Supabase", async () => {
    mockRepoFindById.mockResolvedValue({ ...fakeArquivoDB });
    mockStorageSignedUrl.mockResolvedValue(
      "https://supabase.co/new-signed-url",
    );

    const result = await arquivoService.getById(10);

    expect(mockStorageSignedUrl).toHaveBeenCalledWith(
      "fotos/uuid-abc.jpg",
      3600,
      "supabase",
    );
    expect(result.storage_url).toBe("https://supabase.co/new-signed-url");
  });

  test("não chama getSignedUrl quando arquivo é local", async () => {
    mockRepoFindById.mockResolvedValue({
      ...fakeArquivoDB,
      storage_provider: "local",
      storage_path: null,
    });

    await arquivoService.getById(10);

    expect(mockStorageSignedUrl).not.toHaveBeenCalled();
  });
});

// ─── SUITE: delete ────────────────────────────────────────────────────────────
describe("delete", () => {
  test("realiza soft-delete no banco ANTES de remover do Supabase (C-4)", async () => {
    mockRepoFindById.mockResolvedValue({ ...fakeArquivoDB, uploadedBy: 1 });
    mockStorageDelete.mockResolvedValue(undefined);
    mockRepoDelete.mockResolvedValue({ success: true });

    await arquivoService.delete(10, 1, "admin");

    // C-4: banco PRIMEIRO para garantir atomicidade
    const storageCallOrder = mockStorageDelete.mock.invocationCallOrder[0];
    const dbCallOrder = mockRepoDelete.mock.invocationCallOrder[0];
    expect(dbCallOrder).toBeLessThan(storageCallOrder);

    expect(mockStorageDelete).toHaveBeenCalledWith("fotos/uuid-abc.jpg");
    expect(mockRepoDelete).toHaveBeenCalledWith(10);
  });

  test("lança ForbiddenError quando usuário não é dono nem admin", async () => {
    mockRepoFindById.mockResolvedValue({ ...fakeArquivoDB, uploadedBy: 99 });

    await expect(
      arquivoService.delete(10, 1, "encarregado"),
    ).rejects.toMatchObject({
      message: expect.stringContaining("permissão"),
    });

    expect(mockStorageDelete).not.toHaveBeenCalled();
    expect(mockRepoDelete).not.toHaveBeenCalled();
  });

  test("não chama storageService.delete para arquivos locais", async () => {
    mockRepoFindById.mockResolvedValue({
      ...fakeArquivoDB,
      storage_provider: "local",
      storage_path: null,
      uploadedBy: 1,
    });
    mockRepoDelete.mockResolvedValue({ success: true });

    await arquivoService.delete(10, 1, "admin");

    expect(mockStorageDelete).not.toHaveBeenCalled();
    expect(mockRepoDelete).toHaveBeenCalledWith(10);
  });
});
