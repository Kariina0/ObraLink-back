const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const arquivoRepository = require("../repositories/ArquivoRepository");
const storageService = require("./StorageService");
const { generateSyncId } = require("../utils/helpers");
const { ValidationError } = require("../utils/errors");
const logger = require("../utils/logger");
const { validateBuffer, validateFile } = require("../utils/fileTypeValidator");

class ArquivoService {
  /**
   * Processa upload de um único arquivo.
   * Suporta dois modos transparentemente:
   *   - STORAGE_PROVIDER=supabase → file.buffer (memoryStorage), compressão em RAM, upload ao Supabase
   *   - STORAGE_PROVIDER=local    → file.path   (diskStorage),   compressão em disco, armazenamento local
   */
  async processUpload(file, metadata, userId) {
    const { obra, tipo, descricao, tags, coordenadas } = metadata;
    const tipoNormalizado = tipo || "outros";

    // ── MODO SUPABASE ─────────────────────────────────────────────────────────
    if (storageService.isSupabase()) {
      let buffer = file.buffer;
      let tamanhoFinal = file.size;
      let comprimido = false;
      let dimensoes = null;

      // ── C-3: Validar magic bytes ─────────────────────────────────────────────
      // Impede que arquivos maliciosos sejam enviados com MIME type forjado.
      if (!validateBuffer(buffer, file.mimetype)) {
        throw new ValidationError(
          `O conteúdo do arquivo não corresponde ao tipo declarado (${file.mimetype}). Upload rejeitado.`,
        );
      }

      // Comprimir imagem em memória antes de enviar ao Supabase
      if (file.mimetype.startsWith("image/")) {
        try {
          const sharpInstance = sharp(buffer);
          const imgMeta = await sharpInstance.metadata();
          const compressed = await sharpInstance
            .jpeg({ quality: parseInt(process.env.IMAGE_COMPRESSION_QUALITY) || 80 })
            .toBuffer();

          if (compressed.length < buffer.length) {
            buffer = compressed;
            tamanhoFinal = compressed.length;
            comprimido = true;
          }

          dimensoes = { largura: imgMeta.width, altura: imgMeta.height };
        } catch (err) {
          logger.error("Erro ao comprimir imagem (modo supabase):", err);
        }
      }

      const { storagePath, storageUrl, filename } = await storageService.upload(
        buffer,
        file.originalname,
        tipoNormalizado,
        file.mimetype,
      );

      const arquivoData = {
        nome: filename,
        nomeOriginal: file.originalname,
        caminho: null,                      // sem caminho físico no servidor
        url: storageUrl,
        tipo: tipoNormalizado,
        mimeType: file.mimetype,
        tamanho: tamanhoFinal,
        tamanhoOriginal: file.size,
        dimensoes: dimensoes ? JSON.stringify(dimensoes) : null,
        coordenadas: coordenadas ? JSON.stringify(coordenadas) : null,
        descricao: descricao || null,
        tags: tags ? JSON.stringify(tags.split(",").map((t) => t.trim())) : null,
        obra: obra || null,
        uploadedBy: userId,
        comprimido,
        storage_provider: "supabase",
        storage_path: storagePath,
        storage_url: storageUrl,
        syncId: generateSyncId(),
        metadata: JSON.stringify({ createdBy: userId }),
      };

      return await arquivoRepository.create(arquivoData);
    }

    // ── MODO LOCAL ────────────────────────────────────────────────────────────
    let processedPath = file.path;
    let comprimido = false;
    const tamanhoOriginal = file.size;

    // ── C-3: Validar magic bytes (modo local — lê bytes do disco) ─────────────
    // Fallback para validateBuffer quando file.path não está disponível
    // (ex: memoryStorage em ambiente de testes com STORAGE_PROVIDER=supabase no .env)
    let isMimeValid;
    if (processedPath) {
      isMimeValid = await validateFile(processedPath, file.mimetype);
    } else if (file.buffer) {
      isMimeValid = validateBuffer(file.buffer, file.mimetype);
    } else {
      isMimeValid = false;
    }
    if (!isMimeValid) {
      // Remove o arquivo do disco antes de rejeitar a requisição (somente se existe)
      if (processedPath) {
        await fs.unlink(processedPath).catch((e) =>
          logger.error("Erro ao remover arquivo inválido do disco:", e.message),
        );
      }
      throw new ValidationError(
        `O conteúdo do arquivo não corresponde ao tipo declarado (${file.mimetype}). Upload rejeitado.`,
      );
    }

    if (file.mimetype.startsWith("image/")) {
      try {
        const compressedPath = path.join(
          path.dirname(file.path),
          `compressed-${path.basename(file.path)}`,
        );

        await sharp(file.path)
          .jpeg({ quality: parseInt(process.env.IMAGE_COMPRESSION_QUALITY) || 80 })
          .toFile(compressedPath);

        const imgMeta = await sharp(compressedPath).metadata();
        const stats = await fs.stat(compressedPath);

        if (stats.size < file.size) {
          await fs.unlink(file.path);
          processedPath = compressedPath;
          comprimido = true;
        } else {
          await fs.unlink(compressedPath);
        }

        const arquivoData = {
          nome: path.basename(processedPath),
          nomeOriginal: file.originalname,
          caminho: processedPath,
          url: `/uploads/${tipoNormalizado}/${path.basename(processedPath)}`,
          tipo: tipoNormalizado,
          mimeType: file.mimetype,
          tamanho: comprimido ? stats.size : file.size,
          tamanhoOriginal,
          dimensoes: JSON.stringify({ largura: imgMeta.width, altura: imgMeta.height }),
          coordenadas: coordenadas ? JSON.stringify(coordenadas) : null,
          descricao: descricao || null,
          tags: tags ? JSON.stringify(tags.split(",").map((t) => t.trim())) : null,
          obra: obra || null,
          uploadedBy: userId,
          comprimido,
          storage_provider: "local",
          storage_path: null,
          storage_url: null,
          syncId: generateSyncId(),
          metadata: JSON.stringify({ createdBy: userId }),
        };

        return await arquivoRepository.create(arquivoData);
      } catch (err) {
        logger.error("Erro ao comprimir imagem (modo local):", err);
      }
    }

    // Arquivo não-imagem ou compressão falhou
    const arquivoData = {
      nome: file.filename,
      nomeOriginal: file.originalname,
      caminho: processedPath,
      url: `/uploads/${tipoNormalizado}/${file.filename}`,
      tipo: tipoNormalizado,
      mimeType: file.mimetype,
      tamanho: file.size,
      tamanhoOriginal: file.size,
      coordenadas: coordenadas ? JSON.stringify(coordenadas) : null,
      descricao: descricao || null,
      tags: tags ? JSON.stringify(tags.split(",").map((t) => t.trim())) : null,
      obra: obra || null,
      uploadedBy: userId,
      comprimido: false,
      storage_provider: "local",
      storage_path: null,
      storage_url: null,
      syncId: generateSyncId(),
      metadata: JSON.stringify({ createdBy: userId }),
    };

    return await arquivoRepository.create(arquivoData);
  }

  async processMultipleUploads(files, metadata, userId) {
    const results = [];
    for (const file of files) {
      try {
        const arquivo = await this.processUpload(file, metadata, userId);
        results.push({ success: true, arquivo });
      } catch (error) {
        results.push({ success: false, filename: file.originalname, error: error.message });
      }
    }
    return results;
  }

  async getById(arquivoId, userId, userPerfil) {
    const arquivo = await arquivoRepository.findById(arquivoId);

    const PERFIS = require("../constants").PERFIS;
    const { ForbiddenError } = require("../utils/errors");
    if (
      userPerfil === PERFIS.ENCARREGADO &&
      Number(arquivo.uploadedBy) !== Number(userId)
    ) {
      throw new ForbiddenError("Você não tem permissão para acessar este arquivo");
    }

    // Se o arquivo está no Supabase, gera URL assinada fresca (1h de validade)
    if (arquivo.storage_provider === "supabase" && arquivo.storage_path) {
      try {
        arquivo.storage_url = await storageService.getSignedUrl(arquivo.storage_path);
      } catch (err) {
        logger.error("Erro ao gerar signed URL:", err);
      }
    }

    return arquivo;
  }

  /**
   * Renova as signed URLs do Supabase para uma lista de arquivos.
   * URLs assinadas expiram em 1 hora; listagens devem sempre retornar URLs válidas.
   * C-1: corrige URLs expiradas em getByObra e getByTipo.
   *
   * @param {object[]} arquivos - Array de registros retornados do banco
   */
  async _renewSignedUrls(arquivos) {
    if (!storageService.isSupabase() || !Array.isArray(arquivos)) return;

    await Promise.allSettled(
      arquivos
        .filter((a) => a.storage_provider === "supabase" && a.storage_path)
        .map(async (a) => {
          try {
            a.storage_url = await storageService.getSignedUrl(a.storage_path);
          } catch (err) {
            logger.error(
              `[SIGNED_URL] Falha ao renovar URL do arquivo id=${a.id}: ${err.message}`,
            );
          }
        }),
    );
  }

  async getByObra(obraId, options, userId, userPerfil) {
    const PERFIS = require("../constants").PERFIS;
    const result =
      userPerfil === PERFIS.ENCARREGADO
        ? await arquivoRepository.findAll(
            { obra: Number(obraId), uploadedBy: userId },
            options,
          )
        : await arquivoRepository.findByObra(obraId, options);
    // C-1: renova signed URLs para que a listagem nunca retorne links expirados
    await this._renewSignedUrls(result.data);
    return result;
  }

  async getByTipo(tipo, options, userId, userPerfil) {
    const PERFIS = require("../constants").PERFIS;
    const result =
      userPerfil === PERFIS.ENCARREGADO
        ? await arquivoRepository.findAll(
            { tipo, uploadedBy: userId },
            options,
          )
        : await arquivoRepository.findByTipo(tipo, options);
    // C-1: renova signed URLs para que a listagem nunca retorne links expirados
    await this._renewSignedUrls(result.data);
    return result;
  }

  async delete(arquivoId, userId, userPerfil) {
    const arquivo = await arquivoRepository.findById(arquivoId);

    const PERFIS = require("../constants").PERFIS;
    if (
      Number(arquivo.uploadedBy) !== Number(userId) &&
      userPerfil !== PERFIS.ADMIN
    ) {
      const { ForbiddenError } = require("../utils/errors");
      throw new ForbiddenError("Você não tem permissão para excluir este arquivo");
    }

    // ── C-4: Atomicidade no delete ────────────────────────────────────────────
    // Soft-delete no banco PRIMEIRO — se falhar aqui, nada foi removido do
    // storage e o estado permanece consistente.
    const result = await arquivoRepository.deleteWithFile(arquivoId);

    // Remoção do storage APÓS confirmação do banco.
    // Falha aqui é tolerável: o registro já está marcado como deletado.
    if (arquivo.storage_provider === "supabase" && arquivo.storage_path) {
      try {
        await storageService.delete(arquivo.storage_path);
      } catch (err) {
        logger.error(
          `[DELETE] Arquivo órfão no Supabase — storage_path: "${arquivo.storage_path}". ` +
            `Remova manualmente ou registre para job de limpeza. Erro: ${err.message}`,
        );
      }
    }

    return result;
  }

  async getStorageUsage(obraId = null) {
    return await arquivoRepository.getStorageUsage(obraId);
  }
}

module.exports = new ArquivoService();

