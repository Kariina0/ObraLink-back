const jwt = require("jsonwebtoken");

class JWTConfig {
  constructor() {
    // Provide sane defaults for local development when env vars are missing
    this.secret = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || "dev_jwt_refresh_secret_change_me";
    this.expiresIn = process.env.JWT_EXPIRES_IN || "15m";
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      const msg = "⚠️ JWT secrets not set in .env — using development defaults. Set JWT_SECRET and JWT_REFRESH_SECRET for production.";
      if (process.env.NODE_ENV === "production") {
        throw new Error(msg);
      } else {
        console.warn(msg);
      }
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
    // Preserve original jsonwebtoken errors (name/message) so errorHandler can handle them
    return jwt.verify(token, this.secret);
  }

  verifyRefreshToken(token) {
    // Preserve original jsonwebtoken errors (name/message) so errorHandler can handle them
    return jwt.verify(token, this.refreshSecret);
  }

  generateTokenPair(payload) {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }
}

module.exports = new JWTConfig();
