/**
 * Formata resposta de sucesso padronizada
 */
const successResponse = (
  data,
  message = "Operação realizada com sucesso",
  meta = {},
) => {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
    message,
  };
};

/**
 * Formata resposta de erro padronizada
 */
const errorResponse = (code, message, details = [], statusCode = 500) => {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
    statusCode,
  };
};

/**
 * Calcula paginação
 */
const paginate = (page = 1, limit = 10, total) => {
  const currentPage = parseInt(page);
  const itemsPerPage = parseInt(limit);
  const totalPages = Math.ceil(total / itemsPerPage);
  const skip = (currentPage - 1) * itemsPerPage;

  return {
    pagination: {
      currentPage,
      itemsPerPage,
      totalItems: total,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
    skip,
  };
};

/**
 * Sanitiza objeto removendo campos sensíveis
 */
const sanitize = (obj, fieldsToRemove = ["senha", "password", "__v"]) => {
  if (!obj) return obj;

  const sanitized = { ...obj };
  fieldsToRemove.forEach((field) => delete sanitized[field]);

  return sanitized;
};

/**
 * Gera código único para sincronização
 */
const generateSyncId = () => {
  const { v4: uuidv4 } = require("uuid");
  return `${uuidv4()}-${Date.now()}`;
};

/**
 * Valida coordenadas geográficas
 */
const isValidCoordinates = (lat, lng) => {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

/**
 * Valida unidade de medida
 */
const isValidUnit = (unit) => {
  const validUnits = ["m", "m²", "m³", "kg", "un", "t", "l"];
  return validUnits.includes(unit.toLowerCase());
};

/**
 * Formata data para ISO string
 */
const formatDate = (date) => {
  return date instanceof Date
    ? date.toISOString()
    : new Date(date).toISOString();
};

/**
 * Cria filtros de query dinâmicos
 */
const buildQueryFilters = (queryParams) => {
  const filters = {};

  // Remove campos de paginação
  const {
    page: _page,
    limit: _limit,
    sort: _sort,
    ...filterParams
  } = queryParams;

  Object.keys(filterParams).forEach((key) => {
    if (filterParams[key]) {
      filters[key] = filterParams[key];
    }
  });

  return filters;
};

/**
 * Delay assíncrono (útil para retry)
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry com backoff exponencial
 */
const retryWithBackoff = async (fn, maxAttempts = 3, initialDelay = 1000) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;
};

/**
 * Retorna a URL base pública da API para a requisição atual.
 */
const getRequestBaseUrl = (req) => {
  if (!req) return "";

  const forwardedProto = req.get?.("x-forwarded-proto");
  const forwardedHost = req.get?.("x-forwarded-host");
  const protocol = forwardedProto
    ? forwardedProto.split(",")[0].trim()
    : req.protocol;
  const host = forwardedHost || req.get?.("host");

  if (!protocol || !host) return "";
  return `${protocol}://${host}`;
};

/**
 * Converte uma URL relativa da API em URL absoluta.
 */
const toAbsoluteUrl = (req, resourceUrl) => {
  if (!resourceUrl || typeof resourceUrl !== "string") return resourceUrl;
  if (/^(?:https?:)?\/\//i.test(resourceUrl) || /^data:/i.test(resourceUrl)) {
    return resourceUrl;
  }
  if (!resourceUrl.startsWith("/")) return resourceUrl;

  const configuredBase =
    process.env.PUBLIC_API_URL?.trim() ||
    process.env.API_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    getRequestBaseUrl(req);

  if (!configuredBase) return resourceUrl;

  const normalizedBase = configuredBase.endsWith("/")
    ? configuredBase
    : `${configuredBase}/`;

  return new URL(resourceUrl, normalizedBase).toString();
};

module.exports = {
  successResponse,
  errorResponse,
  paginate,
  sanitize,
  generateSyncId,
  isValidCoordinates,
  isValidUnit,
  formatDate,
  buildQueryFilters,
  sleep,
  retryWithBackoff,
  getRequestBaseUrl,
  toAbsoluteUrl,
};
