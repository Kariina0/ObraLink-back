const express = require("express");
const router = express.Router();
const authController = require("../controllers/AuthController");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} = require("../validators/authValidator");

/**
 * @route POST /api/auth/register
 * @desc Registrar novo usuário
 * @access Public
 */
router.post("/register", validate(registerSchema), authController.register);

/**
 * @route POST /api/auth/login
 * @desc Login de usuário
 * @access Public
 */
router.post("/login", validate(loginSchema), authController.login);

/**
 * @route POST /api/auth/refresh
 * @desc Renovar access token
 * @access Public
 */
router.post("/refresh", authController.refresh);

/**
 * @route POST /api/auth/logout
 * @desc Logout de usuário
 * @access Private
 */
router.post("/logout", authenticate, authController.logout);

/**
 * @route POST /api/auth/change-password
 * @desc Alterar senha do usuário
 * @access Private
 */
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

/**
 * @route GET /api/auth/me
 * @desc Obter dados do usuário atual
 * @access Private
 */
router.get("/me", authenticate, authController.me);

// ✅ Exportar corretamente o router
module.exports = router;
