const {
  detectMimeTypeFromBuffer,
  mimeTypeToExtension,
} = require("../../src/utils/fileTypeValidator");

describe("fileTypeValidator", () => {
  test("detecta JPEG pelo magic bytes", () => {
    const jpegBuffer = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(32, 0x00),
    ]);

    expect(detectMimeTypeFromBuffer(jpegBuffer)).toBe("image/jpeg");
  });

  test("detecta PNG pelo magic bytes", () => {
    const pngBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(32, 0x00),
    ]);

    expect(detectMimeTypeFromBuffer(pngBuffer)).toBe("image/png");
  });

  test("retorna extensao correta para JPEG", () => {
    expect(mimeTypeToExtension("image/jpeg")).toBe(".jpg");
  });
});
