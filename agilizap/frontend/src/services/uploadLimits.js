export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 5;
export function validateUploads(files) {
  if (files.length > MAX_FILES || files.some(file => file.size > MAX_FILE_BYTES)) {
    throw new Error("Envie até cinco arquivos de até 20 MiB cada (100 MiB por envio). O canal pode ter limites menores.");
  }
}
