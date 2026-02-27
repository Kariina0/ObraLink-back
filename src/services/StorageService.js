const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");

/**
 * StorageService — abstração de armazenamento de arquivos.
 *
 * STORAGE_PROVIDER=supabase → arquivos vão para o Supabase Storage (bucket privado).
 * STORAGE_PROVIDER=local    → arquivos ficam no disco local (comportamento legado).
 *
 * Esta camada isola completamente o detalhe de infraestrutura de storage.
 * Controllers e ArquivoService não precisam saber onde o arquivo está guardado.
 *
 * SEGURANÇA (C-5):
 *   - SUPABASE_SERVICE_ROLE_KEY tem privilégio total no projeto Supabase.
 *   - Ela NUNCA é logada, mesmo em mensagens de erro.
 *   - Em produção, a ausência de JWT_SECRET ou da chave lança exceção no boot.
 *   - O método _sanitizeMessage() remove a chave de qualquer string antes de logar.
 */
class StorageService {
  constructor() {
    this.provider = (process.env.STORAGE_PROVIDER || "local").toLowerCase();

    if (this.provider === "supabase") {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error(
          "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios quando STORAGE_PROVIDER=supabase",
        );
      }

      // C-5: Armazena a chave para sanitização de logs mas NUNCA a loga diretamente.
      this._sensitiveKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      this.client = createClient(
        process.env.SUPABASE_URL,
        this._sensitiveKey,
        { auth: { persistSession: false } },
      );
      this.bucket = process.env.SUPABASE_STORAGE_BUCKET || "obras-arquivos";
      logger.info(`✅ StorageService iniciado — provider: supabase (bucket: ${this.bucket})`);
    } else {
      this._sensitiveKey = null;
      logger.info("✅ StorageService iniciado — provider: local");
    }
  }

  /**
   * C-5: Remove a service role key de qualquer string antes de logar.
   * Impede que a chave apareça em mensagens de erro, stack traces, etc.
   *
   * @param {string} message
   * @returns {string}
   */
  _sanitizeMessage(message) {
    if (!this._sensitiveKey || typeof message !== "string") return message;
    return message.replaceAll(this._sensitiveKey, "[SUPABASE_KEY_REDACTED]");
  }

  /**
   * Faz upload de um Buffer para o storage.
   * @param {Buffer} buffer    - Conteúdo binário do arquivo
   * @param {string} filename  - Nome original do arquivo (ex: "foto.jpg")
   * @param {string} tipo      - Subpasta/tipo (ex: "fotos", "documentos", "outros")
   * @param {string} mimeType  - MIME type (ex: "image/jpeg")
   * @returns {{ storagePath: string, storageUrl: string, provider: string }}
   */
  async upload(buffer, filename, tipo, mimeType) {
    const ext = path.extname(filename);
    const uniqueName = `${uuidv4()}-${Date.now()}${ext}`;
    const storagePath = `${tipo || "outros"}/${uniqueName}`;

    if (this.provider === "supabase") {
      const { data, error } = await this.client.storage
        .from(this.bucket)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (error) {
        logger.error("Supabase upload error:", this._sanitizeMessage(error.message));
        throw new Error(`Falha no upload para Supabase: ${this._sanitizeMessage(error.message)}`);
      }

      // Gera URL assinada válida por 1 hora
      const signedUrl = await this.getSignedUrl(data.path);

      logger.info(`📤 Arquivo enviado ao Supabase: ${data.path}`);
      return {
        storagePath: data.path,
        storageUrl: signedUrl,
        provider: "supabase",
        filename: uniqueName,
      };
    }

    // Modo local: arquivo já foi salvo pelo multer diskStorage
    // Apenas retorna o path e a URL relativa
    return {
      storagePath,
      storageUrl: `/uploads/${storagePath}`,
      provider: "local",
      filename: uniqueName,
    };
  }

  /**
   * Gera uma URL assinada para um arquivo privado no Supabase.
   * @param {string} storagePath - Path do arquivo dentro do bucket
   * @param {number} expiresIn   - Validade em segundos (padrão: 3600 = 1h)
   * @returns {Promise<string>} URL assinada
   */
  async getSignedUrl(storagePath, expiresIn = 3600) {
    if (this.provider !== "supabase") {
      return `/uploads/${storagePath}`;
    }

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      logger.error("Supabase signed URL error:", this._sanitizeMessage(error.message));
      throw new Error(`Falha ao gerar URL assinada: ${this._sanitizeMessage(error.message)}`);
    }

    return data.signedUrl;
  }

  /**
   * Remove um arquivo do storage.
   * @param {string} storagePath - Path do arquivo (no bucket ou no disco)
   */
  async delete(storagePath) {
    if (this.provider === "supabase") {
      const { error } = await this.client.storage
        .from(this.bucket)
        .remove([storagePath]);

      if (error) {
        logger.error("Supabase delete error:", this._sanitizeMessage(error.message));
        throw new Error(`Falha ao deletar arquivo no Supabase: ${this._sanitizeMessage(error.message)}`);
      }

      logger.info(`🗑️ Arquivo removido do Supabase: ${storagePath}`);
    }
    // Modo local: remoção do disco é feita pelo ArquivoRepository.deleteWithFile
  }

  isSupabase() {
    return this.provider === "supabase";
  }
}

module.exports = new StorageService();
