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
  _resolveLocalSegmentFromPath(filePath, fallback = "outros") {
    if (!filePath) return fallback;

    const uploadRoot = path.resolve(process.env.UPLOAD_PATH || "./uploads");
    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(uploadRoot, absolutePath);

    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return fallback;
    }

    const [segment] = relativePath.split(path.sep);
    return segment || fallback;
  }

  _replaceExtension(filename, extension) {
    const parsed = path.parse(filename || "arquivo");
    return `${parsed.name}${extension}`;
  }

  /**
   * Processa upload de um único arquivo.
   * Suporta dois modos transparentemente:
   *   - STORAGE_PROVIDER=supabase → file.buffer (memoryStorage), compressão em RAM, upload ao Supabase
   *   - STORAGE_PROVIDER=local    → file.path   (diskStorage),   compressão em disco, armazenamento local
   */
  async processUpload(file, metadata, userId) {
    const {
      obra,
      tipo,
      tipoArquivo,
      descricao,
      tags,
      coordenadas,
      solicitadoPor,
      detalheProblema,
      syncId,
    } = metadata;
    const tipoNormalizado = tipo || "outros";

    // ── Validação de campos obrigatórios ──────────────────────────────────────
    if (!obra) {
      throw new ValidationError("Obra é obrigatória para o envio de arquivos");
    }
    if (!tipoArquivo) {
      throw new ValidationError(
        "Tipo do arquivo é obrigatório (ex: solicitacao, problema, relatorio, medicao, foto_obra, documento, outros)",
      );
    }
    if (!descricao || !descricao.trim()) {
      throw new ValidationError("Descrição do arquivo é obrigatória");
    }

    // ── MODO SUPABASE ─────────────────────────────────────────────────────────
    if (storageService.isSupabase()) {
      let buffer = file.buffer;
      let tamanhoFinal = file.size;
      let comprimido = false;
      let dimensoes = null;
      let uploadMimeType = file.mimetype;
      let uploadFilename = file.originalname;

      // Compatibilidade: quando multer está em diskStorage, não existe file.buffer.
      // Nesse caso, lê o conteúdo do arquivo temporário para manter o fluxo Supabase.
      if (!buffer && file.path) {
        buffer = await fs.readFile(file.path);
      }
      if (!buffer) {
        throw new ValidationError(
          "Arquivo inválido: conteúdo não disponível para upload",
        );
      }

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
            .jpeg({
              quality: parseInt(process.env.IMAGE_COMPRESSION_QUALITY) || 80,
            })
            .toBuffer();

          if (compressed.length < buffer.length) {
            buffer = compressed;
            tamanhoFinal = compressed.length;
            comprimido = true;
            uploadMimeType = "image/jpeg";
            uploadFilename = this._replaceExtension(file.originalname, ".jpg");
          }

          dimensoes = { largura: imgMeta.width, altura: imgMeta.height };
        } catch (err) {
          logger.error("Erro ao comprimir imagem (modo supabase):", err);
        }
      }

      const { storagePath, storageUrl, filename } = await storageService.upload(
        buffer,
        uploadFilename,
        tipoNormalizado,
        uploadMimeType,
      );

      // Se o arquivo veio por diskStorage, remove o temporário após enviar ao storage.
      if (file.path) {
        await fs.unlink(file.path).catch(() => {});
      }

      const arquivoData = {
        nome: filename,
        nomeOriginal: file.originalname,
        caminho: null, // sem caminho físico no servidor
        url: storageUrl,
        tipo: tipoNormalizado,
        tipoArquivo: tipoArquivo || null,
        mimeType: uploadMimeType,
        tamanho: tamanhoFinal,
        tamanhoOriginal: file.size,
        dimensoes: dimensoes ? JSON.stringify(dimensoes) : null,
        coordenadas: coordenadas ? JSON.stringify(coordenadas) : null,
        descricao: descricao || null,
        detalheProblema: detalheProblema || null,
        solicitadoPor: solicitadoPor ? Number(solicitadoPor) : null,
        tags: tags
          ? JSON.stringify(tags.split(",").map((t) => t.trim()))
          : null,
        obra: obra || null,
        uploadedBy: userId,
        comprimido,
        storage_provider: "supabase",
        storage_path: storagePath,
        storage_url: storageUrl,
        syncId: syncId || generateSyncId(),
        metadata: JSON.stringify({ createdBy: userId }),
      };

      return await arquivoRepository.create(arquivoData);
    }

    // ── MODO LOCAL ────────────────────────────────────────────────────────────
    let processedPath = file.path;
    let comprimido = false;
    const tamanhoOriginal = file.size;
    let storedMimeType = file.mimetype;

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
        await fs
          .unlink(processedPath)
          .catch((e) =>
            logger.error(
              "Erro ao remover arquivo inválido do disco:",
              e.message,
            ),
          );
      }
      throw new ValidationError(
        `O conteúdo do arquivo não corresponde ao tipo declarado (${file.mimetype}). Upload rejeitado.`,
      );
    }

    if (file.mimetype.startsWith("image/")) {
      try {
        // Suporta dois fluxos: diskStorage (file.path) e memoryStorage (file.buffer).
        let imgMeta;
        let stats;
        let compressedPath;

        if (file.path) {
          const parsedPath = path.parse(file.path);
          compressedPath = path.join(
            path.dirname(file.path),
            `compressed-${parsedPath.name}.jpg`,
          );

          await sharp(file.path)
            .jpeg({ quality: parseInt(process.env.IMAGE_COMPRESSION_QUALITY) || 80 })
            .toFile(compressedPath);

          imgMeta = await sharp(compressedPath).metadata();
          stats = await fs.stat(compressedPath);

          if (stats.size < file.size) {
            await fs.unlink(file.path).catch(() => {});
            processedPath = compressedPath;
            comprimido = true;
            storedMimeType = "image/jpeg";
          } else {
            await fs.unlink(compressedPath).catch(() => {});
          }
        } else if (file.buffer) {
          // Escrever buffer comprimido em arquivo temporário
          const tmpDir = require("os").tmpdir();
          const { v4: uuidv4 } = require("uuid");
          compressedPath = path.join(tmpDir, `compressed-${uuidv4()}.jpg`);

          const compressedBuffer = await sharp(file.buffer)
            .jpeg({ quality: parseInt(process.env.IMAGE_COMPRESSION_QUALITY) || 80 })
            .toBuffer();

          await fs.writeFile(compressedPath, compressedBuffer);
          imgMeta = await sharp(compressedPath).metadata();
          stats = await fs.stat(compressedPath);

          if (stats.size < file.size) {
            processedPath = compressedPath;
            comprimido = true;
            storedMimeType = "image/jpeg";
          } else {
            // compressão não melhorou — manter buffer original (sem arquivo temporário)
            await fs.unlink(compressedPath).catch(() => {});
          }
        }

        if (processedPath) {
          const localSegment = this._resolveLocalSegmentFromPath(
            processedPath,
            tipoNormalizado,
          );
          const localFilename = path.basename(processedPath);

          const arquivoData = {
            nome: localFilename,
            nomeOriginal: file.originalname,
            caminho: processedPath,
            url: `/api/files/raw/${localSegment}/${localFilename}`,
            tipo: tipoNormalizado,
            tipoArquivo: tipoArquivo || null,
            mimeType: storedMimeType,
            tamanho: comprimido ? stats.size : file.size,
            tamanhoOriginal,
            dimensoes: JSON.stringify({ largura: imgMeta?.width, altura: imgMeta?.height }),
            coordenadas: coordenadas ? JSON.stringify(coordenadas) : null,
            descricao: descricao || null,
            detalheProblema: detalheProblema || null,
            solicitadoPor: solicitadoPor ? Number(solicitadoPor) : null,
            tags: tags ? JSON.stringify(tags.split(",").map((t) => t.trim())) : null,
            obra: obra || null,
            uploadedBy: userId,
            comprimido,
            storage_provider: "local",
            storage_path: null,
            storage_url: null,
            syncId: syncId || generateSyncId(),
            metadata: JSON.stringify({ createdBy: userId }),
          };

          return await arquivoRepository.create(arquivoData);
        }
      } catch (err) {
        logger.error("Erro ao comprimir imagem (modo local):", err);
      }
    }

    // Arquivo não-imagem ou compressão falhou
    const localSegment = this._resolveLocalSegmentFromPath(
      processedPath,
      tipoNormalizado,
    );
    const localFilename = processedPath
      ? path.basename(processedPath)
      : file.filename || file.originalname;

    const arquivoData = {
      nome: localFilename,
      nomeOriginal: file.originalname,
      caminho: processedPath,
      url: `/api/files/raw/${localSegment}/${localFilename}`,
      tipo: tipoNormalizado,
      tipoArquivo: tipoArquivo || null,
      mimeType: storedMimeType,
      tamanho: file.size,
      tamanhoOriginal: file.size,
      coordenadas: coordenadas ? JSON.stringify(coordenadas) : null,
      descricao: descricao || null,
      detalheProblema: detalheProblema || null,
      solicitadoPor: solicitadoPor ? Number(solicitadoPor) : null,
      tags: tags ? JSON.stringify(tags.split(",").map((t) => t.trim())) : null,
      obra: obra || null,
      uploadedBy: userId,
      comprimido: false,
      storage_provider: "local",
      storage_path: null,
      storage_url: null,
      syncId: syncId || generateSyncId(),
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
        results.push({
          success: false,
          filename: file.originalname,
          error: error.message,
        });
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
      throw new ForbiddenError(
        "Você não tem permissão para acessar este arquivo",
      );
    }

    // Se o arquivo está no Supabase, gera URL assinada fresca (1h de validade)
    if (arquivo.storage_provider === "supabase" && arquivo.storage_path) {
      try {
        arquivo.storage_url = await storageService.getSignedUrl(
          arquivo.storage_path,
          3600,
          arquivo.storage_provider,
        );
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
    if (!Array.isArray(arquivos)) return;

    await Promise.allSettled(
      arquivos
        .filter((a) => a.storage_provider === "supabase" && a.storage_path)
        .map(async (a) => {
          try {
            a.storage_url = await storageService.getSignedUrl(
              a.storage_path,
              3600,
              a.storage_provider,
            );
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
        ? await arquivoRepository.findAll({ tipo, uploadedBy: userId }, options)
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
      throw new ForbiddenError(
        "Você não tem permissão para excluir este arquivo",
      );
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
