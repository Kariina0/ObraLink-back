/**
 * fileTypeValidator.js
 *
 * Valida o tipo real de um arquivo inspecionando seus magic bytes (assinatura binária),
 * independentemente do Content-Type declarado pelo cliente.
 *
 * Isso impede que arquivos maliciosos sejam enviados com um MIME type forjado.
 *
 * Tipos suportados: JPEG, PNG, HEIC/HEIF, PDF
 */

const fs = require("fs").promises;

/**
 * Tabela de assinaturas binárias por MIME type.
 * Cada tipo pode ter múltiplos padrões de assinatura (ex: JPEG tem variantes).
 */
const heifCompatibleBrands = [
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
];

const isoBmffSignature = (brand) => ({
  offset: 4,
  bytes: [0x66, 0x74, 0x79, 0x70, ...Buffer.from(brand, "ascii")],
});

const SIGNATURES = {
  "image/jpeg": [
    [0xff, 0xd8, 0xff, 0xe0],
    [0xff, 0xd8, 0xff, 0xe1],
    [0xff, 0xd8, 0xff, 0xe2],
    [0xff, 0xd8, 0xff, 0xe3],
    [0xff, 0xd8, 0xff, 0xdb],
    [0xff, 0xd8, 0xff, 0xee],
  ],
  "image/jpg": [
    [0xff, 0xd8, 0xff, 0xe0],
    [0xff, 0xd8, 0xff, 0xe1],
    [0xff, 0xd8, 0xff, 0xdb],
  ],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/heic": heifCompatibleBrands.map(isoBmffSignature),
  "image/heif": heifCompatibleBrands.map(isoBmffSignature),
  "image/heic-sequence": heifCompatibleBrands.map(isoBmffSignature),
  "image/heif-sequence": heifCompatibleBrands.map(isoBmffSignature),
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

function getSignatureLength(signature) {
  if (Array.isArray(signature)) return signature.length;
  if (!signature || !Array.isArray(signature.bytes)) return 0;
  return (signature.offset || 0) + signature.bytes.length;
}

/**
 * Número de bytes necessários para a assinatura mais longa.
 */
const MAX_SIG_LEN = Math.max(
  ...Object.values(SIGNATURES).flatMap((signatures) =>
    signatures.map((signature) => getSignatureLength(signature)),
  ),
);

/**
 * Verifica se um array de bytes (número) confere com o início do buffer.
 *
 * @param {Buffer} buffer
 * @param {number[]} signature
 * @returns {boolean}
 */
function matchesSignature(buffer, signature) {
  const normalized = Array.isArray(signature)
    ? { offset: 0, bytes: signature }
    : signature;

  if (!normalized || !Array.isArray(normalized.bytes)) return false;

  const { offset = 0, bytes } = normalized;
  if (buffer.length < offset + bytes.length) return false;

  return bytes.every((byte, i) => buffer[offset + i] === byte);
}

/**
 * Valida magic bytes de um Buffer em memória (modo Supabase / memoryStorage).
 *
 * @param {Buffer} buffer       - Conteúdo binário do arquivo
 * @param {string} declaredMime - MIME type declarado pelo cliente
 * @returns {boolean}           - true se o arquivo é realmente do tipo declarado
 */
function validateBuffer(buffer, declaredMime) {
  const sigs = SIGNATURES[declaredMime];
  if (!sigs) return false;
  return sigs.some((sig) => matchesSignature(buffer, sig));
}

/**
 * Detecta o MIME type real a partir do buffer usando as assinaturas conhecidas.
 * Retorna null quando o conteúdo não corresponde a nenhum tipo suportado.
 *
 * @param {Buffer} buffer
 * @returns {string|null}
 */
function detectMimeTypeFromBuffer(buffer) {
  for (const [mimeType, signatures] of Object.entries(SIGNATURES)) {
    if (signatures.some((signature) => matchesSignature(buffer, signature))) {
      return mimeType;
    }
  }

  return null;
}

/**
 * Valida magic bytes de um arquivo salvo em disco (modo local / diskStorage).
 * Lê apenas os primeiros bytes necessários, sem carregar o arquivo inteiro.
 *
 * @param {string} filePath     - Caminho absoluto do arquivo no disco
 * @param {string} declaredMime - MIME type declarado pelo cliente
 * @returns {Promise<boolean>}
 */
async function validateFile(filePath, declaredMime) {
  const sigs = SIGNATURES[declaredMime];
  if (!sigs) return false;

  const maxLen = Math.max(
    ...sigs.map((signature) => getSignatureLength(signature)),
  );
  let fd;
  try {
    fd = await fs.open(filePath, "r");
    const buf = Buffer.alloc(maxLen);
    await fd.read(buf, 0, maxLen, 0);
    return sigs.some((sig) => matchesSignature(buf, sig));
  } finally {
    if (fd) await fd.close().catch(() => {});
  }
}

/**
 * Detecta o MIME type real de um arquivo em disco lendo apenas o cabeçalho.
 *
 * @param {string} filePath
 * @returns {Promise<string|null>}
 */
async function detectMimeTypeFromFile(filePath) {
  let fd;
  try {
    fd = await fs.open(filePath, "r");
    const buf = Buffer.alloc(MAX_SIG_LEN);
    await fd.read(buf, 0, MAX_SIG_LEN, 0);
    return detectMimeTypeFromBuffer(buf);
  } finally {
    if (fd) await fd.close().catch(() => {});
  }
}

function mimeTypeToExtension(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/heic":
      return ".heic";
    case "image/heif":
      return ".heif";
    case "image/heic-sequence":
      return ".heic";
    case "image/heif-sequence":
      return ".heif";
    case "application/pdf":
      return ".pdf";
    default:
      return "";
  }
}

/**
 * Retorna os MIME types suportados pela validação.
 * Tipos não listados aqui retornarão false em validateBuffer/validateFile.
 *
 * @returns {string[]}
 */
function getSupportedMimeTypes() {
  return Object.keys(SIGNATURES);
}

module.exports = {
  validateBuffer,
  validateFile,
  detectMimeTypeFromBuffer,
  detectMimeTypeFromFile,
  mimeTypeToExtension,
  getSupportedMimeTypes,
  MAX_SIG_LEN,
};
