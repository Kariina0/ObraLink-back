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
  forgotPasswordSchema,
  resetPasswordSchema,
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
 * Rate limiter para refresh token — evita abuso do endpoint de renovação.
 * Máximo de 30 tentativas por IP a cada 15 minutos. (C-3)
 */
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.REFRESH_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "fail",
    message: "Muitas tentativas de renovação de token. Tente novamente em 15 minutos.",
  },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.FORGOT_PASSWORD_RATE_LIMIT_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "fail",
    message: "Muitas solicitações de recuperação. Tente novamente em 15 minutos.",
  },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RESET_PASSWORD_RATE_LIMIT_MAX) || 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "fail",
    message: "Muitas tentativas de redefinição. Tente novamente em 15 minutos.",
  },
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
 * @access Public (rate limited — C-3)
 */
router.post("/refresh", refreshLimiter, authController.refresh);

/**
 * @route POST /api/auth/forgot-password
 * @desc Solicitar código para recuperação de senha
 * @access Public
 */
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);

/**
 * @route POST /api/auth/reset-password
 * @desc Redefinir senha usando código recebido
 * @access Public
 */
router.post(
  "/reset-password",
  resetPasswordLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

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
