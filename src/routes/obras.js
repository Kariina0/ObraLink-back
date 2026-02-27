const express = require('express');
const router = express.Router();
const obraController = require('../controllers/ObraController');
const { authenticate } = require('../middleware/auth');

// Todas as rotas requerem autenticação
router.use(authenticate);

// Lista obras (opcional: ?page=&limit=&status=)
router.get('/', obraController.list);

module.exports = router;
