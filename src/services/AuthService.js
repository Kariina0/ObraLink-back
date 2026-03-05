const userRepository = require("../repositories/UserRepository");
const jwtConfig = require("../config/jwt");
const {
  UnauthorizedError,
  ConflictError,
  ValidationError,
} = require("../utils/errors");
const { generateSyncId } = require("../utils/helpers");
const { PERFIS } = require("../constants");
const bcrypt = require("bcryptjs");

class AuthService {
  async register(userData) {
    // Garante perfil válido — padrão ENCARREGADO; ADMIN pode definir SUPERVISOR
    const perfisPermitidos = [PERFIS.ENCARREGADO, PERFIS.SUPERVISOR];
    if (!userData.perfil || !perfisPermitidos.includes(userData.perfil)) {
      userData.perfil = PERFIS.ENCARREGADO;
    }

    // Verificar se email já existe
    const existingUser = await userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictError("Email já cadastrado");
    }

    // Gerar syncId se não fornecido
    if (!userData.syncId) {
      userData.syncId = generateSyncId();
    }

    // Hash da senha e criar usuário
    if (userData.senha) {
      userData.senha = await bcrypt.hash(String(userData.senha), 12);
    }
    const user = await userRepository.create(userData);

    // Gerar tokens
    const tokens = jwtConfig.generateTokenPair({ id: user.id, email: user.email, perfil: user.perfil });

    // Hash do refresh token antes de salvar
    const hashedRefresh = await bcrypt.hash(tokens.refreshToken, 12);
    await userRepository.updateRefreshToken(user.id, hashedRefresh);

    return { user, tokens };
  }

  async login(email, senha) {
    // Buscar usuário
    const user = await userRepository.findByEmail(email);
    if (!user || !user.isActive) throw new UnauthorizedError("Credenciais inválidas");

    const isPasswordValid = await bcrypt.compare(String(senha), String(user.senha || ""));
    if (!isPasswordValid) throw new UnauthorizedError("Credenciais inválidas");

    const tokens = jwtConfig.generateTokenPair({ id: user.id, email: user.email, perfil: user.perfil });
    const hashedRefresh = await bcrypt.hash(tokens.refreshToken, 12);
    await userRepository.updateRefreshToken(user.id, hashedRefresh);

    // remove sensitive fields
    const safeUser = { ...user };
    delete safeUser.senha;
    delete safeUser.refreshToken;

    return { user: safeUser, tokens };
  }

  async refreshToken(refreshToken) {
    try {
      // Verificar refresh token
      const decoded = jwtConfig.verifyRefreshToken(refreshToken);
      // Buscar usuário
      const user = await userRepository.findById(decoded.id);
      if (!user || !user.isActive) throw new UnauthorizedError("Usuário não encontrado ou inativo");

      // Verificar se o refresh token corresponde ao armazenado (hash)
      const storedHash = user.refreshToken;
      if (!storedHash) throw new UnauthorizedError("Refresh token não encontrado");

      const isValid = await bcrypt.compare(String(refreshToken), String(storedHash));
      if (!isValid) throw new UnauthorizedError("Refresh token inválido");

      // Gerar novos tokens
      const tokens = jwtConfig.generateTokenPair({ id: user.id, email: user.email, perfil: user.perfil });

      // Salvar novo refresh token (hash)
      const newHash = await bcrypt.hash(tokens.refreshToken, 12);
      await userRepository.updateRefreshToken(user.id, newHash);

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
    const existing = await userRepository.findById(userId);
    if (!existing) throw new ValidationError("Usuário não encontrado");

    const user = await userRepository.findByEmail(existing.email);
    const isPasswordValid = await bcrypt.compare(String(senhaAtual), String(user.senha || ""));
    if (!isPasswordValid) throw new ValidationError("Senha atual incorreta");

    // Validação de complexidade da nova senha
    if (!novaSenha || novaSenha.length < 8) {
      throw new ValidationError("A senha deve ter pelo menos 8 caracteres.");
    }
    if (!/[A-Z]/.test(novaSenha)) {
      throw new ValidationError("A senha deve conter ao menos uma letra maiúscula.");
    }
    if (!/[0-9]/.test(novaSenha)) {
      throw new ValidationError("A senha deve conter ao menos um número.");
    }

    const hashed = await bcrypt.hash(String(novaSenha), 12);
    await userRepository.update(userId, { senha: hashed });
    return { message: "Senha alterada com sucesso" };
  }
}

module.exports = new AuthService();
