const authService = require("../services/AuthService");
const userRepository = require("../repositories/UserRepository");
const UserDTO = require("../dtos/UserDTO");
const { successResponse } = require("../utils/helpers");
const { asyncHandler } = require("../middleware/errorHandler");

class AuthController {
  /**
   * @route POST /api/auth/register
   * @desc Cadastrar novo funcionário — acesso exclusivo ADMIN
   * @access Private (admin)
   */
  register = asyncHandler(async (req, res) => {
    const { user } = await authService.register(req.body);

    res.status(201).json(
      successResponse(
        { user: new UserDTO(user) },
        "Funcionário cadastrado com sucesso",
      ),
    );
  });

  /**
   * @route POST /api/auth/login
   * @desc Login de usuário
   * @access Public
   */
  login = asyncHandler(async (req, res) => {
    const { user, tokens } = await authService.login(
      req.body.email,
      req.body.senha,
    );

    res.json(
      successResponse(
        {
          user: new UserDTO(user),
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
        "Login realizado com sucesso",
      ),
    );
  });

  /**
   * @route POST /api/auth/refresh
   * @desc Renovar access token
   * @access Public
   */
  refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshToken(refreshToken);

    res.json(successResponse(tokens, "Token renovado com sucesso"));
  });

  /**
   * @route POST /api/auth/logout
   * @desc Logout de usuário
   * @access Private
   */
  logout = asyncHandler(async (req, res) => {
    await authService.logout(req.user.id);

    res.json(successResponse(null, "Logout realizado com sucesso"));
  });

  /**
   * @route POST /api/auth/change-password
   * @desc Alterar senha do usuário
   * @access Private
   */
  changePassword = asyncHandler(async (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    await authService.changePassword(req.user.id, senhaAtual, novaSenha);

    res.json(successResponse(null, "Senha alterada com sucesso"));
  });

  /**
   * @route GET /api/auth/me
   * @desc Obter dados do usuário atual
   * @access Private
   */
  me = asyncHandler(async (req, res) => {
    const user = await userRepository.findById(req.user.id, ["obraAtual"]);

    res.json(successResponse(new UserDTO(user), "Dados do usuário"));
  });

  /**
   * @route GET /api/auth/users
   * @desc Listar todos os usuários do sistema (para admin selecionar encarregados/responsáveis)
   * @access Admin, Supervisor
   *
   * Query params:
   *  - perfil  (string) filtra por perfil: admin | supervisor | encarregado
   *  - page    (number) página atual (default 1)
   *  - limit   (number) itens por página (default 100)
   */
  listUsers = asyncHandler(async (req, res) => {
    const { perfil, page = 1, limit = 100 } = req.query;

    // Filtra por perfil quando informado; do contrário retorna todos
    const filter = {};
    if (perfil) filter.perfil = perfil;

    const result = await userRepository.findAll(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    // Remove campos sensíveis antes de retornar
    const users = result.data.map((u) => new UserDTO(u));
    res.json(successResponse(users, "Usuários listados", {
      pagination: {
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
        totalItems: result.total,
      },
    }));
  });
}

module.exports = new AuthController();
