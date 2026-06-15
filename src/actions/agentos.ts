"use server";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { generateImportPrompt } from "@/lib/import-prompt";
import { importPayloadSchema, ImportPayload } from "@/lib/import-schemas";

// The prompt ends with this separator before the content placeholder.
// We split here to isolate the system instructions from the user's content.
const PROMPT_SEPARATOR = "\n---\nNow extract the data from the following content:\n\n";

// Extra instructions appended to the system prompt when running through AgentOS,
// where Claude has WebSearch and WebFetch available to fill in missing details.
const WEB_TOOLS_INSTRUCTIONS = `
ADDITIONAL CAPABILITIES:
You have access to web search (WebSearch) and page fetch (WebFetch) tools. Use them proactively to enrich the extracted data when details are missing or ambiguous:
- If a hotel or accommodation is mentioned without a city or address, search for it.
- If an activity or restaurant lacks a location, search to confirm the city or venue.
- If a flight origin/destination is a city name instead of IATA code, verify the correct IATA code.
- Do NOT search for price information unless it is completely absent from the provided content.
Always prioritize the information explicitly stated in the provided content over web results.`;

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
    const session = await auth();
    if (!session?.user?.id) redirect("/auth/signin");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    throw new Error("Error de autenticación.");
  }

  const agentosUrl = process.env.AGENTOS_URL;
  const agentosKey = process.env.AGENTOS_API_KEY;
  if (!agentosUrl || !agentosKey) {
    throw new Error("AgentOS no está configurado en este entorno.");
  }

  const fullPrompt = generateImportPrompt(options);
  const systemPrompt = fullPrompt.split(PROMPT_SEPARATOR)[0] + WEB_TOOLS_INSTRUCTIONS;

  let res: Response;
  try {
    res = await fetch(`${agentosUrl}/api/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agentosKey}`,
      },
      body: JSON.stringify({
        prompt: content,
        system_prompt: systemPrompt,
        model: "claude-haiku-4-5-20251001",
        timeout_seconds: 180,
        tools: ["WebFetch", "WebSearch"],
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
