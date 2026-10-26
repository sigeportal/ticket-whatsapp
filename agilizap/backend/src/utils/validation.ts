import { z, ZodError, ZodSchema } from "zod";
import AppError from "../errors/AppError";

/**
 * Validador de dados baseado em Zod.
 * Em caso de falha, formata os erros e lança AppError com HTTP 400.
 */
export function validateZod<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      const fieldPath = firstIssue?.path.length ? `[${firstIssue.path.join(".")}] ` : "";
      const message = firstIssue ? `${fieldPath}${firstIssue.message}` : "ERR_VALIDATION";
      throw new AppError(message, 400);
    }
    throw error;
  }
}

/**
 * Validador assíncrono baseado em Zod (para schemas com refinamentos assíncronos de banco/IO).
 */
export async function validateZodAsync<T>(schema: ZodSchema<T>, data: unknown): Promise<T> {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      const fieldPath = firstIssue?.path.length ? `[${firstIssue.path.join(".")}] ` : "";
      const message = firstIssue ? `${fieldPath}${firstIssue.message}` : "ERR_VALIDATION";
      throw new AppError(message, 400);
    }
    throw error;
  }
}

/**
 * Schemas primitivos reutilizáveis para higienização e validação de payloads.
 */
export const CommonSchemas = {
  id: z.coerce.number().int().positive("ID deve ser um número inteiro positivo"),
  uuid: z.string().uuid("Formato de UUID inválido"),
  email: z.string().email("Endereço de e-mail inválido").trim().toLowerCase(),
  pagination: z.object({
    pageNumber: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    searchParam: z.string().optional()
  })
};

export { z };
