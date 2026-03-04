const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/AuthController");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} = require("../validators/authValidator");

/**
 * Rate limiter dedicado para login — mínimo de tentativas para evitar brute-force.
 * Máximo de 10 tentativas por IP a cada 15 minutos.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "fail",
    message: "Muitas tentativas de login. Tente novamente em 15 minutos.",
  },
  skipSuccessfulRequests: true,
});

/**
 * @route POST /api/auth/register
 * @desc Cadastrar novo funcionário — acesso exclusivo ADMIN
 * @access Private (admin)
 */
router.post(
  "/register",
  authenticate,
  authorize("admin"),
  validate(registerSchema),
  authController.register
);

/**
 * @route POST /api/auth/login
 * @desc Login de usuário
 * @access Public
 */
router.post("/login", loginLimiter, validate(loginSchema), authController.login);

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

/**
 * @route GET /api/auth/users
 * @desc Listar usuários (para seleção de encarregados/responsáveis em obras)
 * @access Admin, Supervisor
 */
router.get(
  "/users",
  authenticate,
  authorize("admin", "supervisor"),
  authController.listUsers
);

// ✅ Exportar corretamente o router
module.exports = router;
