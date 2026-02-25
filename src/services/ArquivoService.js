const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const arquivoRepository = require("../repositories/ArquivoRepository");
const { generateSyncId } = require("../utils/helpers");
const { ValidationError } = require("../utils/errors");

class ArquivoService {
  async processUpload(file, metadata, userId) {
    const { obra, tipo, descricao, tags, coordenadas } = metadata;

    let processedPath = file.path;
    let comprimido = false;
    let tamanhoOriginal = file.size;

    // Comprimir imagem se for JPEG ou PNG
    if (file.mimetype.startsWith("image/")) {
      try {
        const compressedPath = path.join(
          path.dirname(file.path),
          `compressed-${path.basename(file.path)}`,
        );

        await sharp(file.path)
          .jpeg({
            quality: parseInt(process.env.IMAGE_COMPRESSION_QUALITY) || 80,
          })
          .toFile(compressedPath);

        // Obter dimensões da imagem
        const metadata = await sharp(compressedPath).metadata();
        const stats = await fs.stat(compressedPath);

        // Se o arquivo comprimido for menor, usar ele
        if (stats.size < file.size) {
          await fs.unlink(file.path);
          processedPath = compressedPath;
          comprimido = true;
        } else {
          await fs.unlink(compressedPath);
        }

        // Criar registro no banco
        const arquivoData = {
          nome: path.basename(processedPath),
          nomeOriginal: file.originalname,
          caminho: processedPath,
          url: `/uploads/${tipo}/${path.basename(processedPath)}`,
          tipo: tipo || "outros",
          mimeType: file.mimetype,
          tamanho: comprimido ? stats.size : file.size,
          tamanhoOriginal,
          dimensoes: {
            largura: metadata.width,
            altura: metadata.height,
          },
          coordenadas: coordenadas || undefined,
          descricao,
          tags: tags ? tags.split(",").map((t) => t.trim()) : [],
          obra,
          uploadedBy: userId,
          comprimido,
          syncId: generateSyncId(),
          metadata: {
            createdBy: userId,
          },
        };

        return await arquivoRepository.create(arquivoData);
      } catch (error) {
        // Se falhar, usar arquivo original
        const logger = require("../utils/logger");
        logger.error("Erro ao comprimir imagem:", error);
      }
    }

    // Para arquivos não-imagem ou se a compressão falhar
    const arquivoData = {
      nome: file.filename,
      nomeOriginal: file.originalname,
      caminho: processedPath,
      url: `/uploads/${tipo}/${file.filename}`,
      tipo: tipo || "outros",
      mimeType: file.mimetype,
      tamanho: file.size,
      coordenadas: coordenadas || undefined,
      descricao,
      tags: tags ? tags.split(",").map((t) => t.trim()) : [],
      obra,
      uploadedBy: userId,
      comprimido: false,
      syncId: generateSyncId(),
      metadata: {
        createdBy: userId,
      },
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

  async getById(arquivoId) {
    return await arquivoRepository.findById(arquivoId, ["obra", "uploadedBy"]);
  }

  async getByObra(obraId, options) {
    return await arquivoRepository.findByObra(obraId, options);
  }

  async getByTipo(tipo, options) {
    return await arquivoRepository.findByTipo(tipo, options);
  }

  async delete(arquivoId, userId, userPerfil) {
    const arquivo = await arquivoRepository.findById(arquivoId);

    // Verificar permissão
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

    return await arquivoRepository.deleteWithFile(arquivoId);
  }

  async getStorageUsage(obraId = null) {
    return await arquivoRepository.getStorageUsage(obraId);
  }
}

module.exports = new ArquivoService();
