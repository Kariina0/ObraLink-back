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
  const { page, limit, sort, ...filterParams } = queryParams;

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
};
