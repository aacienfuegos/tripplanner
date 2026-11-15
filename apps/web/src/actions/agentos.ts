"use server";

import { requireUser } from "@/lib/action-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { generateImportSystemPrompt, generateImportUserMessage, importPayloadSchema, ImportPayload } from "@tripplanner/shared";

// Extracts a JSON object from Claude's output, which may contain explanatory text,
// markdown code fences, and/or sources before or after the actual JSON.
function extractJson(raw: string): string {
  // 1. Prefer an explicit ```json ... ``` or ``` ... ``` block anywhere in the text
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]?.trim().startsWith("{")) return fenceMatch[1].trim();

  // 2. Fall back to the first { ... last } span (handles bare JSON embedded in text)
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) return raw.slice(start, end + 1);

  return raw.trim();
}

// serverActions.bodySizeLimit is 50mb for the Diving Log import; each call here
// costs a model run, so cap what reaches AgentOS well below that.
const MAX_CONTENT_CHARS = 200_000;

// Server action arguments arrive unvalidated: an array would pass a .length check.
const inputSchema = z.object({
  content: z.string().max(MAX_CONTENT_CHARS),
  options: z
    .object({
      tripStartDate: z.string().max(40).optional(),
      tripEndDate: z.string().max(40).optional(),
    })
    .optional(),
});

function agentosErrorMessage(status: number): string {
  if (status === 401 || status === 403)
    return "La API key de AgentOS no es válida o ha sido revocada.";
  if (status === 408)
    return "La IA tardó demasiado. Inténtalo de nuevo o usa el modo manual.";
  if (status === 429)
    return "Demasiadas peticiones simultáneas. Espera unos segundos e inténtalo de nuevo.";
  return "Error en el servidor de IA. Inténtalo de nuevo.";
}

export async function runAgentOSImport(
  content: string,
  options?: { tripStartDate?: string; tripEndDate?: string },
): Promise<ImportPayload> {
  try {
    await requireUser();
  } catch (e) {
    if (isRedirectError(e)) throw e;
    console.error("runAgentOSImport: requireUser falló", e);
    throw new Error("Error de autenticación.");
  }

  const input = inputSchema.safeParse({ content, options });
  if (!input.success) {
    const tooLong = input.error.issues.some(
      (i) => i.code === "too_big" && i.path[0] === "content",
    );
    throw new Error(
      tooLong
        ? "El contenido es demasiado largo (máximo 200.000 caracteres). Recórtalo o usa el modo manual."
        : "Entrada no válida.",
    );
  }

  const agentosUrl = process.env.AGENTOS_URL;
  const agentosKey = process.env.AGENTOS_API_KEY;
  if (!agentosUrl || !agentosKey) {
    throw new Error("AgentOS no está configurado en este entorno.");
  }

  const systemPrompt = generateImportSystemPrompt();
  const userMessage = generateImportUserMessage(input.data.content, input.data.options);

  let res: Response;
  try {
    res = await fetch(`${agentosUrl}/api/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agentosKey}`,
      },
      body: JSON.stringify({
        system_prompt: systemPrompt,
        prompt: userMessage,
        model: "claude-sonnet-4-6",
        timeout_seconds: 300,
        tools: [],
      }),
    });
  } catch {
    throw new Error(
      "No se pudo conectar con AgentOS. Verifica que el servicio esté disponible.",
    );
  }

  if (!res.ok) {
    throw new Error(agentosErrorMessage(res.status));
  }

  const data = await res.json();
  const raw: string = data.output ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new Error(
      "La IA no devolvió un JSON válido. Prueba el modo manual y revisa que el contenido sea legible.",
    );
  }

  const result = importPayloadSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.join(".");
    throw new Error(
      path
        ? `Formato incorrecto en "${path}". Prueba el modo manual para revisar la respuesta.`
        : "La respuesta de la IA no tiene el formato esperado. Prueba el modo manual.",
    );
  }

  return result.data;
}
