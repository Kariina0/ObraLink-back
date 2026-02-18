const userRepository = require("../repositories/UserRepository");
const jwtConfig = require("../config/jwt");
const {
  UnauthorizedError,
  ConflictError,
  ValidationError,
} = require("../utils/errors");
const { generateSyncId } = require("../utils/helpers");

class AuthService {
  async register(userData) {
    // Verificar se email já existe
    const existingUser = await userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictError("Email já cadastrado");
    }

    // Gerar syncId se não fornecido
    if (!userData.syncId) {
      userData.syncId = generateSyncId();
    }

    // Criar usuário
    const user = await userRepository.create(userData);

    // Gerar tokens
    const tokens = jwtConfig.generateTokenPair({
      id: user._id,
      email: user.email,
      perfil: user.perfil,
    });

    // Salvar refresh token
    await userRepository.updateRefreshToken(user._id, tokens.refreshToken);

    return { user, tokens };
  }

  async login(email, senha) {
    // Buscar usuário
    const user = await userRepository.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Credenciais inválidas");
    }

    // Verificar senha
    const isPasswordValid = await user.comparePassword(senha);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Credenciais inválidas");
    }

    // Gerar tokens
    const tokens = jwtConfig.generateTokenPair({
      id: user._id,
      email: user.email,
      perfil: user.perfil,
    });

    // Salvar refresh token
    await userRepository.updateRefreshToken(user._id, tokens.refreshToken);

    // Remover senha da resposta
    user.senha = undefined;
    user.refreshToken = undefined;

    return { user, tokens };
  }

  async refreshToken(refreshToken) {
    try {
      // Verificar refresh token
      const decoded = jwtConfig.verifyRefreshToken(refreshToken);

      // Buscar usuário
      const user = await userRepository.findById(decoded.id);
      if (!user || !user.isActive) {
        throw new UnauthorizedError("Usuário não encontrado ou inativo");
      }

      // Gerar novos tokens
      const tokens = jwtConfig.generateTokenPair({
        id: user._id,
        email: user.email,
        perfil: user.perfil,
      });

      // Atualizar refresh token
      await userRepository.updateRefreshToken(user._id, tokens.refreshToken);

      return tokens;
    } catch (error) {
      throw new UnauthorizedError("Refresh token inválido");
    }
  }

  async logout(userId) {
    await userRepository.clearRefreshToken(userId);
    return { message: "Logout realizado com sucesso" };
  }

  async changePassword(userId, senhaAtual, novaSenha) {
    const user = await userRepository.findByEmail(
      (await userRepository.findById(userId)).email,
    );

    // Verificar senha atual
    const isPasswordValid = await user.comparePassword(senhaAtual);
    if (!isPasswordValid) {
      throw new ValidationError("Senha atual incorreta");
    }

    // Atualizar senha
    user.senha = novaSenha;
    await user.save();

    return { message: "Senha alterada com sucesso" };
  }
}

module.exports = new AuthService();
