import type { z } from "zod";

export const MAX_API_BODY_BYTES = 64 * 1024;

// Cloudflare está delante: con una regla "Cache Everything" sobre el dominio,
// una respuesta privada sin no-store se serviría a terceros.
const NO_STORE = { "Cache-Control": "no-store" } as const;

export type ApiErrorCode =
  | "INVALID_JSON"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "PAYLOAD_TOO_LARGE"
  | "VALIDATION_FAILED"
  | "INTERNAL";

interface ApiIssue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

export function apiJson(status: number, data: unknown): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  issues?: readonly ApiIssue[],
): Response {
  return Response.json(
    { error: { code, message, ...(issues ? { issues } : {}) } },
    { status, headers: NO_STORE },
  );
}

export const notFound = () => apiError(404, "NOT_FOUND", "Resource not found");

const payloadTooLarge = () =>
  apiError(413, "PAYLOAD_TOO_LARGE", `A Content-Length of at most ${MAX_API_BODY_BYTES} bytes is required`);

// Sin el valor recibido: solo la ruta del campo y el mensaje de Zod.
function validationFailed(error: z.ZodError): Response {
  const issues = error.issues.map((issue) => ({
    path: issue.path.map((segment) => (typeof segment === "number" ? segment : String(segment))),
    message: issue.message,
  }));
  return apiError(422, "VALIDATION_FAILED", "The request body is not valid", issues);
}

type BodyResult<T> = { ok: true; data: T } | { ok: false; response: Response };

// Los route handlers no tienen límite de body propio (bodySizeLimit solo aplica
// a Server Actions): se rechaza por Content-Length antes de leer y, por si el
// header miente, se corta la lectura al pasar del límite.
export async function readJsonBody(request: Request): Promise<BodyResult<unknown>> {
  const contentLength = request.headers.get("content-length");
  if (!contentLength || !/^\d+$/.test(contentLength) || Number(contentLength) > MAX_API_BODY_BYTES) {
    return { ok: false, response: payloadTooLarge() };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = request.body?.getReader();
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_API_BODY_BYTES) {
        await reader.cancel();
        return { ok: false, response: payloadTooLarge() };
      }
      chunks.push(value);
    }
  }

  try {
    return { ok: true, data: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, response: apiError(400, "INVALID_JSON", "The request body is not valid JSON") };
  }
}

export async function readValidatedBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<BodyResult<z.infer<S>>> {
  const body = await readJsonBody(request);
  if (!body.ok) return body;
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return { ok: false, response: validationFailed(parsed.error) };
  return { ok: true, data: parsed.data };
}
