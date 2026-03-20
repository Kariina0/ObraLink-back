const fs = require("fs");
const path = require("path");
const request = require("supertest");

const app = require("../../src/app");

describe("files raw route", () => {
  const uploadRoot = path.resolve(process.env.UPLOAD_PATH || "./uploads");
  const tipo = "foto_obra";
  const filename = `raw-test-${Date.now()}.jpg`;
  const folderPath = path.join(uploadRoot, tipo);
  const filePath = path.join(folderPath, filename);

  beforeAll(() => {
    fs.mkdirSync(folderPath, { recursive: true });
    // Conteúdo mínimo para servir arquivo (não precisa ser jpeg válido para este teste)
    fs.writeFileSync(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]));
  });

  afterAll(() => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  test("GET /api/files/raw/:tipo/:filename retorna 200 quando arquivo existe", async () => {
    const res = await request(app).get(`/api/files/raw/${tipo}/${filename}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/jpeg");
  });

  test("GET /api/files/raw bloqueia path traversal", async () => {
    const res = await request(app).get("/api/files/raw/foto_obra/..%2Fwin.ini");

    expect(res.status).toBe(400);
  });
});
