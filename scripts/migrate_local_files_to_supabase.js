require("dotenv").config();

const fs = require("fs").promises;
const path = require("path");

const supabase = require("../src/config/supabaseClient");
const storageService = require("../src/services/StorageService");
const {
  detectMimeTypeFromFile,
  mimeTypeToExtension,
} = require("../src/utils/fileTypeValidator");

function resolveAbsolutePath(filePath) {
  if (!filePath) return null;
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(__dirname, "..", filePath);
}

function buildUploadFilename(arquivo, mimeType) {
  const baseName = path.parse(
    arquivo.nomeOriginal || arquivo.nome || `arquivo-${arquivo.id}`,
  ).name;
  const extension =
    mimeTypeToExtension(mimeType) ||
    path.extname(arquivo.nome || arquivo.nomeOriginal || "");
  return `${baseName}${extension}`;
}

async function listPendingFiles() {
  const { data, error } = await supabase
    .from("arquivos")
    .select(
      "id,nome,nomeOriginal,caminho,url,tipo,tipoArquivo,mimeType,storage_provider,storage_path,storage_url",
    )
    .eq("storage_provider", "local")
    .not("caminho", "is", null)
    .order("id", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function migrateFile(arquivo) {
  const absolutePath = resolveAbsolutePath(arquivo.caminho);
  if (!absolutePath) {
    return {
      id: arquivo.id,
      success: false,
      reason: "Arquivo sem caminho físico",
    };
  }

  const buffer = await fs.readFile(absolutePath);
  const detectedMimeType =
    (await detectMimeTypeFromFile(absolutePath)) || arquivo.mimeType;

  if (!detectedMimeType) {
    return {
      id: arquivo.id,
      success: false,
      reason: "MIME type não suportado",
    };
  }

  const uploadFilename = buildUploadFilename(arquivo, detectedMimeType);
  const { storagePath, storageUrl, filename } = await storageService.upload(
    buffer,
    uploadFilename,
    arquivo.tipo || "outros",
    detectedMimeType,
  );

  const { error: updateError } = await supabase
    .from("arquivos")
    .update({
      nome: filename,
      caminho: null,
      url: storageUrl,
      mimeType: detectedMimeType,
      storage_provider: "supabase",
      storage_path: storagePath,
      storage_url: storageUrl,
    })
    .eq("id", arquivo.id);

  if (updateError) {
    await storageService.delete(storagePath).catch(() => {});
    throw updateError;
  }

  await fs.unlink(absolutePath).catch(() => {});

  return {
    id: arquivo.id,
    success: true,
    storagePath,
    mimeType: detectedMimeType,
  };
}

async function main() {
  if (!storageService.isSupabase()) {
    throw new Error(
      "Defina STORAGE_PROVIDER=supabase antes de migrar arquivos locais.",
    );
  }

  const files = await listPendingFiles();

  if (files.length === 0) {
    console.log("Nenhum arquivo local pendente de migracao.");
    return;
  }

  console.log(
    `Migrando ${files.length} arquivo(s) local(is) para o Supabase...`,
  );

  const results = [];
  for (const arquivo of files) {
    try {
      const result = await migrateFile(arquivo);
      results.push(result);
      console.log(`OK arquivo ${arquivo.id} -> ${result.storagePath}`);
    } catch (error) {
      results.push({ id: arquivo.id, success: false, reason: error.message });
      console.log(`ERRO arquivo ${arquivo.id}: ${error.message}`);
    }
  }

  const successCount = results.filter((item) => item.success).length;
  const failed = results.filter((item) => !item.success);

  console.log(
    JSON.stringify(
      {
        total: results.length,
        migrated: successCount,
        failed,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
