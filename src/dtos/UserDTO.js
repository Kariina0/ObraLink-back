class UserDTO {
  constructor(user) {
    this.id = user.id || user._id;
    this.nome = user.nome;
    this.email = user.email;
    this.perfil = user.perfil;
    this.obraAtual = user.obraAtual;
    this.isActive = user.isActive;
    this.lastSync = user.lastSync;
    this.syncId = user.syncId;

    const meta = UserDTO._parseJson(user.metadata, {});
    this.createdAt = user.created_at || meta.createdAt;
    this.updatedAt = user.updated_at || meta.updatedAt;
  }

  static _parseJson(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return fallback; }
  }
}

module.exports = UserDTO;
