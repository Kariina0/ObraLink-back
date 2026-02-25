const jwt = require("jsonwebtoken");

class JWTConfig {
  constructor() {
    // Provide sane defaults for local development when env vars are missing
    this.secret = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || "dev_jwt_refresh_secret_change_me";
    this.expiresIn = process.env.JWT_EXPIRES_IN || "15m";
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.warn("⚠️ JWT secrets not set in .env — using development defaults. Set JWT_SECRET and JWT_REFRESH_SECRET for production.");
    }
  }

  generateAccessToken(payload) {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
    });
  }

  generateRefreshToken(payload) {
    return jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn,
    });
  }

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      throw new Error("Token inválido ou expirado");
    }
  }

  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshSecret);
    } catch (error) {
      throw new Error("Refresh token inválido ou expirado");
    }
  }

  generateTokenPair(payload) {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }
}

module.exports = new JWTConfig();
