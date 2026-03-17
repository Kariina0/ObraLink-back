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
const crypto = require("crypto");
const emailService = require("./EmailService");
const logger = require("../utils/logger");

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
    } catch (_error) {
      throw new UnauthorizedError("Refresh token inválido");
    }
  }

  async logout(userId) {
    await userRepository.clearRefreshToken(userId);
    return { message: "Logout realizado com sucesso" };
  }

  async changePassword(userId, senhaAtual, novaSenha) {
    const user = await userRepository.findById(userId);
    if (!user) throw new ValidationError("Usuário não encontrado");

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

  async requestPasswordReset(email) {
    const genericMessage =
      "Se o e-mail estiver cadastrado, você receberá instruções para redefinir a senha.";

    const user = await userRepository.findByEmail(email);
    if (!user || !user.isActive) {
      return { message: genericMessage };
    }

    const resetCode = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const resetHash = await bcrypt.hash(resetCode, 10);
    const ttlMinutes = parseInt(process.env.RESET_PASSWORD_TTL_MINUTES || "15", 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await userRepository.update(user.id, {
      resetPasswordToken: resetHash,
      resetPasswordExpiresAt: expiresAt,
      resetPasswordUsedAt: null,
    });

    // Enviar email com o código de recuperação (fire-and-forget — não bloqueia a resposta)
    emailService.sendPasswordResetCode(user.email, resetCode, expiresAt).catch((err) => {
      logger.error(`[AUTH] Falha ao enviar email de recuperação para ${user.email}:`, err.message);
    });

    const result = { message: genericMessage };

    if (
      process.env.NODE_ENV !== "production" &&
      process.env.EXPOSE_DEV_CODES === "true"
    ) {
      result.devResetCode = resetCode;
      result.expiresAt = expiresAt.toISOString();
    }

    return result;
  }

  async resetPasswordWithCode({ email, codigo, novaSenha }) {
    const user = await userRepository.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Código inválido ou expirado");
    }

    if (!user.resetPasswordToken || !user.resetPasswordExpiresAt) {
      throw new UnauthorizedError("Código inválido ou expirado");
    }

    if (user.resetPasswordUsedAt) {
      throw new UnauthorizedError("Código inválido ou expirado");
    }

    const expiresAt = new Date(user.resetPasswordExpiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError("Código inválido ou expirado");
    }

    const isValidCode = await bcrypt.compare(String(codigo), String(user.resetPasswordToken));
    if (!isValidCode) {
      throw new UnauthorizedError("Código inválido ou expirado");
    }

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

    const hashedSenha = await bcrypt.hash(String(novaSenha), 12);
    await userRepository.update(user.id, {
      senha: hashedSenha,
      refreshToken: null,
      resetPasswordUsedAt: new Date(),
      resetPasswordToken: null,
      resetPasswordExpiresAt: null,
    });

    return { message: "Senha redefinida com sucesso" };
  }
}

module.exports = new AuthService();
