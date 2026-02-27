const solicitacaoRepository = require("../repositories/SolicitacaoCompraRepository");
const { PERFIS } = require("../constants");

// Criar nova solicitação de compra (usando SQLite via PurchaseRepository)
const createPurchase = async (req, res) => {
  try {
    const { items } = req.body;

    const purchase = await solicitacaoRepository.create({
      itens: JSON.stringify(Array.isArray(items) ? items : []),
      prioridade: "media",
      status: "pendente",
      solicitante: req.user.id,
      dataSolicitacao: new Date(),
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
    const filter = req.user.perfil === PERFIS.ENCARREGADO
      ? { solicitante: req.user.id }
      : {};
    const result = await solicitacaoRepository.findAll(filter, {
      limit: 100,
      sort: { id: -1 },
    });
    res.json({ success: true, data: result.data });
  } catch (error) {
    const logger = require("../utils/logger");
    logger.error("Erro ao buscar purchases:", error);
    res.status(500).json({ success: false, message: "Erro ao buscar solicitações" });
  }
};

module.exports = { createPurchase, getPurchases };
