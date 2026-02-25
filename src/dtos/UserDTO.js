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
    this.createdAt = user.metadata?.createdAt;
    this.updatedAt = user.metadata?.updatedAt;
  }
}

module.exports = UserDTO;
