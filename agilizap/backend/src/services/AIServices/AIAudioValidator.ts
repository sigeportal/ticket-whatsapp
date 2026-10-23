import fs from "fs";
import { spawn } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { logger } from "../../utils/logger";

export const MAX_AI_AUDIO_DURATION_SECONDS = 600; // 10 minutos (D-07)
export const MAX_AI_AUDIO_FILE_BYTES = 20 * 1024 * 1024; // 20 MB (D-07)

export interface AudioValidationResult {
  valid: boolean;
  reason?: string;
  durationSeconds?: number;
  sizeBytes?: number;
}

const getFfmpegBinary = (): string => {
  if (ffmpegInstaller?.path && fs.existsSync(ffmpegInstaller.path)) {
    return ffmpegInstaller.path;
  }
  return "ffmpeg";
};

export const parseDurationFromFfmpegOutput = (output: string): number | null => {
  const match = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
  if (!match) return null;
  const hours = parseFloat(match[1]);
  const minutes = parseFloat(match[2]);
  const seconds = parseFloat(match[3]);
  return hours * 3600 + minutes * 60 + seconds;
};

export const probeAudioDurationServerSide = async (
  filePath: string,
  timeoutMs: number = 4000
): Promise<number | null> => {
  return new Promise(resolve => {
    const ffmpegPath = getFfmpegBinary();
    let stderr = "";
    let resolved = false;

    const child = spawn(ffmpegPath, ["-nostdin", "-i", filePath], {
      windowsHide: true
    });

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { child.kill("SIGKILL"); } catch (e) {}
        logger.warn(`[AIAudioValidator] Timeout de inspeção de áudio (${timeoutMs}ms): ${filePath}`);
        resolve(null);
      }
    }, timeoutMs);

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.on("error", err => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        logger.warn(`[AIAudioValidator] Erro ao spawnar ffmpeg: ${err.message}`);
        resolve(null);
      }
    });

    child.on("close", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        const duration = parseDurationFromFfmpegOutput(stderr);
        resolve(duration);
      }
    });
  });
};

export const validateAudioForAI = async (
  filePath: string,
  options?: {
    maxDurationSeconds?: number;
    maxSizeBytes?: number;
    mockDurationSeconds?: number;
  }
): Promise<AudioValidationResult> => {
  if (!filePath || !fs.existsSync(filePath)) {
    return { valid: false, reason: "FILE_NOT_FOUND" };
  }

  const stat = fs.statSync(filePath);
  const sizeBytes = stat.size;
  const maxBytes = options?.maxSizeBytes ?? MAX_AI_AUDIO_FILE_BYTES;
  const maxDuration = options?.maxDurationSeconds ?? MAX_AI_AUDIO_DURATION_SECONDS;

  // 1. Validar tamanho máximo (20 MB)
  if (sizeBytes > maxBytes) {
    return {
      valid: false,
      reason: "FILE_SIZE_EXCEEDS_LIMIT",
      sizeBytes
    };
  }

  // 2. Medir duração no servidor
  let durationSeconds: number | null = null;
  if (options?.mockDurationSeconds !== undefined) {
    durationSeconds = options.mockDurationSeconds;
  } else {
    durationSeconds = await probeAudioDurationServerSide(filePath);
  }

  // Se não foi possível medir a duração por falha técnica de probe, ou se duration > maxDuration
  if (durationSeconds !== null && durationSeconds > maxDuration) {
    return {
      valid: false,
      reason: "DURATION_EXCEEDS_LIMIT",
      durationSeconds,
      sizeBytes
    };
  }

  return {
    valid: true,
    durationSeconds: durationSeconds ?? undefined,
    sizeBytes
  };
};
