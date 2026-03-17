const BaseRepository = require("./BaseRepository");

class UserRepository extends BaseRepository {
  constructor() {
    super("users");
  }

  async findByEmail(email) {
    const { data, error } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = this.supabase
        .from(this.table)
        .select("*")
        .eq("email", email);
      if (withDeletedAt) query = query.is("deletedAt", null);
      return query.maybeSingle();
    });

    if (error) throw error;
    return data ?? null;
  }

  async findByAuthId(authId) {
    const { data, error } = await this._runWithDeletedAtFallback((withDeletedAt) => {
      let query = this.supabase
        .from(this.table)
        .select("*")
        .eq("auth_id", authId);
      if (withDeletedAt) query = query.is("deletedAt", null);
      return query.maybeSingle();
    });

    if (error) throw error;
    if (!data) {
      const { NotFoundError } = require("../utils/errors");
      throw new NotFoundError("Usuário não encontrado");
    }
    return data;
  }

  async findBySyncId(syncId) {
    return this.findOne({ syncId });
  }

  async updateRefreshToken(userId, refreshToken) {
    return this.update(userId, { refreshToken });
  }

  async clearRefreshToken(userId) {
    return this.update(userId, { refreshToken: null });
  }

  async findByObraAtual(obraId, options = {}) {
    return this.findAll({ obraAtual: obraId }, options);
  }

  async updateLastSync(userId) {
    return this.update(userId, { lastSync: new Date().toISOString() });
  }

  /**
   * Exportação de dados pessoais (LGPD).
   * Remove campos sensíveis (senha, refreshToken) antes de retornar.
   */
  async exportUserData(userId) {
    const rawUser = await this.findById(userId);

    // Remove campos sensíveis — não devem constar em exportações LGPD
    const { senha, refreshToken, resetPasswordToken, ...safeUser } = rawUser;

    const [medicoes, diarios, solicitacoes, arquivos] = await Promise.all([
      this.supabase.from("medicoes").select("*").eq("responsavel", userId).is("deletedAt", null),
      this.supabase.from("diarios").select("*").eq("responsavel", userId).is("deletedAt", null),
      this.supabase.from("solicitacoes_compra").select("*").eq("solicitante", userId).is("deletedAt", null),
      this.supabase.from("arquivos").select("*").eq("uploadedBy", userId).is("deletedAt", null),
    ]);

    return {
      usuario: safeUser,
      medicoes: medicoes.data ?? [],
      diarios: diarios.data ?? [],
      solicitacoes: solicitacoes.data ?? [],
      arquivos: arquivos.data ?? [],
    };
  }
}

module.exports = new UserRepository();
