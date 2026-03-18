const { toAbsoluteUrl } = require("../../src/utils/helpers");
const { validateBuffer } = require("../../src/utils/fileTypeValidator");

describe("helpers.toAbsoluteUrl", () => {
  test("converte URL relativa da API em absoluta usando a requisição", () => {
    const req = {
      protocol: "https",
      get(header) {
        const headers = {
          host: "api.example.com",
        };
        return headers[String(header).toLowerCase()] || null;
      },
    };

    expect(toAbsoluteUrl(req, "/api/files/raw/foto_obra/teste.jpg")).toBe(
      "https://api.example.com/api/files/raw/foto_obra/teste.jpg",
    );
  });

  test("mantém URLs absolutas sem alteração", () => {
    const absoluteUrl = "https://cdn.example.com/foto.jpg";
    expect(toAbsoluteUrl(null, absoluteUrl)).toBe(absoluteUrl);
  });
});

describe("fileTypeValidator HEIC", () => {
  test("aceita assinatura HEIC válida", () => {
    const buffer = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
      0x00, 0x00, 0x00, 0x00,
    ]);

    expect(validateBuffer(buffer, "image/heic")).toBe(true);
  });

  test("rejeita HEIC com assinatura inválida", () => {
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00,
    ]);
    expect(validateBuffer(buffer, "image/heic")).toBe(false);
  });
});
