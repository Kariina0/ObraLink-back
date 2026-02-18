const express = require("express");
const { createPurchase, getPurchases } = require("../controllers/purchaseController");
const { authenticate } = require("../middleware/auth"); // usar authenticate

const router = express.Router();

router.post("/", authenticate, createPurchase);
router.get("/", authenticate, getPurchases);

module.exports = router;
