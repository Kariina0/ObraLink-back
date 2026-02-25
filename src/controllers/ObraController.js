const obraRepository = require('../repositories/ObraRepository');
const { successResponse, errorResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

class ObraController {
  // GET /api/obras
  list = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const options = { page: parseInt(page), limit: parseInt(limit) };
    const filter = {};
    if (status) filter.status = status;

    const result = await obraRepository.findAll(filter, options);
    res.json(successResponse(result, 'Lista de obras'));
  });
}

module.exports = new ObraController();
