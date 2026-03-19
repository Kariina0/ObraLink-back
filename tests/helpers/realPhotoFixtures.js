const fs = require("fs");
const path = require("path");

const PHOTO_FILENAMES = ["foto-obra.jpg", "foto-obra1.jpg", "foto-obra2.jpg"];
const PHOTO_DIRS = [
  path.resolve(__dirname, "../../imagens"),
  path.resolve(__dirname, "../../../frontend/static"),
];

function resolvePhotoPath(filename) {
  for (const dirPath of PHOTO_DIRS) {
    const photoPath = path.join(dirPath, filename);
    if (fs.existsSync(photoPath)) {
      return photoPath;
    }
  }

  throw new Error(
    `Arquivo de fixture não encontrado em nenhum diretório esperado: ${filename}`,
  );
}

function getRealPhotoPaths() {
  return PHOTO_FILENAMES.map(resolvePhotoPath);
}

function getRealPhotoPath(index = 0) {
  const filenames = PHOTO_FILENAMES;
  return resolvePhotoPath(filenames[index % filenames.length]);
}

function getRealPhotoFilename(index = 0) {
  return PHOTO_FILENAMES[index % PHOTO_FILENAMES.length];
}

function attachRealPhoto(requestBuilder, fieldName = "file", index = 0) {
  const photoPath = getRealPhotoPath(index);

  return requestBuilder.attach(fieldName, photoPath, {
    filename: getRealPhotoFilename(index),
    contentType: "image/jpeg",
  });
}

function attachAllRealPhotos(requestBuilder, fieldName = "files") {
  return getRealPhotoPaths().reduce(
    (builder, photoPath, index) =>
      builder.attach(fieldName, photoPath, {
        filename: getRealPhotoFilename(index),
        contentType: "image/jpeg",
      }),
    requestBuilder,
  );
}

module.exports = {
  PHOTO_FILENAMES,
  getRealPhotoPaths,
  getRealPhotoPath,
  getRealPhotoFilename,
  attachRealPhoto,
  attachAllRealPhotos,
};