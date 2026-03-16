const BaseRepository = require("./BaseRepository");

class UserRepository extends BaseRepository {
  constructor() {
    super("users");
  }

  async findByEmail(email) {
    await this._ensureTable();
    const qb = this.knex(this.table).where({ email });
    await this._applyNotDeleted(qb);
    return await qb.first();
  }

  async findBySyncId(syncId) {
    return await this.findOne({ syncId });
  }

  async updateRefreshToken(userId, refreshToken) {
    return await this.update(userId, { refreshToken });
  }

  async clearRefreshToken(userId) {
    return await this.update(userId, { refreshToken: null });
  }

  async findByObraAtual(obraId, options = {}) {
    return await this.findAll({ obraAtual: obraId }, options);
  }

  async updateLastSync(userId) {
    return await this.update(userId, { lastSync: new Date() });
  }

  async exportUserData(userId) {
    await this._ensureTable();
    const rawUser = await this.findById(userId);

    // I-5: Remove campos sensíveis antes de exportar — hash de senha e refreshToken
    // não são dados do usuário e não devem constar em exportações LGPD.
    const { senha, refreshToken, ...safeUser } = rawUser;

    const medicoes = await this.knex("medicoes").where({ responsavel: userId }).andWhereRaw("(metadata IS NULL OR (metadata::jsonb)->>'deletedAt' IS NULL)");
    const diarios = await this.knex("diarios").where({ responsavel: userId }).andWhereRaw("(metadata IS NULL OR (metadata::jsonb)->>'deletedAt' IS NULL)");
    const solicitacoes = await this.knex("solicitacoes_compra").where({ solicitante: userId }).andWhereRaw("(metadata IS NULL OR (metadata::jsonb)->>'deletedAt' IS NULL)");
    const arquivos = await this.knex("arquivos").where({ uploadedBy: userId }).andWhereRaw("(metadata IS NULL OR (metadata::jsonb)->>'deletedAt' IS NULL)");

    return {
      usuario: safeUser,
      medicoes,
      diarios,
      solicitacoes,
      arquivos,
    };
  }
}

module.exports = new UserRepository();
