import { Readable } from "stream";
export const readLimitedStream = async (stream: Readable, maxBytes: number, timeoutMs: number): Promise<Buffer> => {
  const timer = setTimeout(() => stream.destroy(new Error("ERR_MEDIA_TIMEOUT")), timeoutMs);
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > maxBytes) throw new Error("ERR_MEDIA_LIMIT");
      chunks.push(bytes);
    }
    return Buffer.concat(chunks, size);
  } finally { clearTimeout(timer); stream.destroy(); }
};
