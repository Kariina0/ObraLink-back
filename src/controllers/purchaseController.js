const Purchase = require("../models/Purchase");

// Criar nova solicitação de compra
const createPurchase = async (req, res) => {
  try {
    const { items } = req.body;

    const purchase = await Purchase.create({
      items,
      status: "Em análise",
      user: req.user.id,
    });

    res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: "Erro ao criar solicitação" });
  }
};

// Listar solicitações do usuário
const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find({ user: req.user.id });
    res.json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: "Erro ao buscar solicitações" });
  }
};

module.exports = { createPurchase, getPurchases };
