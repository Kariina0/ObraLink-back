const express = require('express');
const router = express.Router();
const obraController = require('../controllers/ObraController');

// Lista obras (opcional: ?page=&limit=&status=)
router.get('/', obraController.list);

module.exports = router;
