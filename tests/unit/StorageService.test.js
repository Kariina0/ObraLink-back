/**
 * Testes unitários — StorageService
 *
 * Cobre:
 *  - upload para Supabase (mock do cliente)
 *  - getSignedUrl (sucesso e falha)
 *  - delete no Supabase
 *  - comportamento em modo local (STORAGE_PROVIDER=local)
 */

// ─── Variáveis do mock do cliente Supabase ────────────────────────────────────
const mockUpload      = jest.fn();
const mockSignedUrl   = jest.fn();
const mockRemove      = jest.fn();
const mockStorageFrom = jest.fn(() => ({
  upload:           mockUpload,
  createSignedUrl:  mockSignedUrl,
  remove:           mockRemove,
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    storage: { from: mockStorageFrom },
  })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadService(provider = "supabase") {
  jest.resetModules();
  process.env.STORAGE_PROVIDER          = provider;
  process.env.SUPABASE_URL              = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  process.env.SUPABASE_STORAGE_BUCKET   = "obras-arquivos";
  // Re-importa o módulo para pegar as env vars novas
  return require("../../src/services/StorageService");
}

// ─── Testes ──────────────────────────────────────────────────────────────────
describe("StorageService — modo supabase", () => {
  let storageService;

  beforeEach(() => {
    jest.clearAllMocks();
    storageService = loadService("supabase");
  });

  test("isSupabase() retorna true quando STORAGE_PROVIDER=supabase", () => {
    expect(storageService.isSupabase()).toBe(true);
  });

  test("upload() faz upload do buffer e retorna storagePath e storageUrl", async () => {
    mockUpload.mockResolvedValue({ data: { path: "fotos/uuid-1234.jpg" }, error: null });
    mockSignedUrl.mockResolvedValue({ data: { signedUrl: "https://supabase.co/signed/uuid-1234.jpg" }, error: null });

    const buffer = Buffer.from("fake-image-bytes");
    const result = await storageService.upload(buffer, "foto.jpg", "fotos", "image/jpeg");

    expect(mockStorageFrom).toHaveBeenCalledWith("obras-arquivos");
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^fotos\/.+\.jpg$/),
      buffer,
      { contentType: "image/jpeg", upsert: false },
    );
    expect(result.storagePath).toMatch(/^fotos\/.+\.jpg$/);
    expect(result.storageUrl).toBe("https://supabase.co/signed/uuid-1234.jpg");
    expect(result.provider).toBe("supabase");
  });

  test("upload() lança erro quando Supabase retorna error", async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: "bucket not found" } });

    await expect(
      storageService.upload(Buffer.from("x"), "test.jpg", "fotos", "image/jpeg"),
    ).rejects.toThrow("Falha no upload para Supabase: bucket not found");
  });

  test("getSignedUrl() retorna URL assinada válida", async () => {
    mockSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://supabase.co/signed/path.jpg?token=abc" },
      error: null,
    });

    const url = await storageService.getSignedUrl("fotos/path.jpg", 3600);

    expect(mockSignedUrl).toHaveBeenCalledWith("fotos/path.jpg", 3600);
    expect(url).toBe("https://supabase.co/signed/path.jpg?token=abc");
  });

  test("getSignedUrl() lança erro quando Supabase retorna error", async () => {
    mockSignedUrl.mockResolvedValue({ data: null, error: { message: "file not found" } });

    await expect(storageService.getSignedUrl("fotos/gone.jpg")).rejects.toThrow(
      "Falha ao gerar URL assinada: file not found",
    );
  });

  test("delete() remove o arquivo do bucket", async () => {
    mockRemove.mockResolvedValue({ data: {}, error: null });

    await expect(storageService.delete("fotos/path.jpg")).resolves.not.toThrow();
    expect(mockRemove).toHaveBeenCalledWith(["fotos/path.jpg"]);
  });

  test("delete() lança erro quando Supabase retorna error", async () => {
    mockRemove.mockResolvedValue({ data: null, error: { message: "permission denied" } });

    await expect(storageService.delete("fotos/path.jpg")).rejects.toThrow(
      "Falha ao deletar arquivo no Supabase: permission denied",
    );
  });
});

describe("StorageService — modo local", () => {
  let storageService;

  beforeEach(() => {
    jest.clearAllMocks();
    storageService = loadService("local");
  });

  test("isSupabase() retorna false quando STORAGE_PROVIDER=local", () => {
    expect(storageService.isSupabase()).toBe(false);
  });

  test("upload() em modo local retorna URL relativa sem chamar Supabase", async () => {
    const result = await storageService.upload(
      Buffer.from("x"),
      "foto.png",
      "fotos",
      "image/png",
    );

    expect(mockUpload).not.toHaveBeenCalled();
    expect(result.provider).toBe("local");
    expect(result.storageUrl).toMatch(/^\/api\/files\/raw\/fotos\//);
  });

  test("getSignedUrl() em modo local retorna path relativo", async () => {
    const url = await storageService.getSignedUrl("fotos/path.jpg");
    expect(url).toBe("/api/files/raw/fotos/path.jpg");
    expect(mockSignedUrl).not.toHaveBeenCalled();
  });

  test("delete() em modo local não chama Supabase", async () => {
    await expect(storageService.delete("fotos/path.jpg")).resolves.not.toThrow();
    expect(mockRemove).not.toHaveBeenCalled();
  });
});

describe("StorageService — construtor sem variáveis de ambiente", () => {
  test("lança erro se SUPABASE_URL não estiver definido no modo supabase", () => {
    jest.resetModules();
    process.env.STORAGE_PROVIDER = "supabase";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => require("../../src/services/StorageService")).toThrow(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios",
    );

    // Restaurar
    process.env.SUPABASE_URL              = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  });
});
