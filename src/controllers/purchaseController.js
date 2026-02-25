const purchaseRepository = require("../repositories/PurchaseRepository");

// Criar nova solicitação de compra (usando SQLite via PurchaseRepository)
const createPurchase = async (req, res) => {
  try {
    const { items } = req.body;

    const purchase = await purchaseRepository.createPurchase({
      items,
      status: "Em análise",
      user: req.user.id,
      createdAt: new Date(),
    });

    res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    const logger = require("../utils/logger");
    logger.error("Erro ao criar purchase:", error);
    res.status(500).json({ success: false, message: "Erro ao criar solicitação" });
  }
};

// Listar solicitações do usuário
const getPurchases = async (req, res) => {
  try {
    const result = await purchaseRepository.findByUser(req.user.id, { limit: 100 });
    res.json({ success: true, data: result.data });
  } catch (error) {
    const logger = require("../utils/logger");
    logger.error("Erro ao buscar purchases:", error);
    res.status(500).json({ success: false, message: "Erro ao buscar solicitações" });
  }
};

module.exports = { createPurchase, getPurchases };
