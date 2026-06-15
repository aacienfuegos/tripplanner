"use server";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { generateImportPrompt } from "@/lib/import-prompt";
import { importPayloadSchema, ImportPayload } from "@/lib/import-schemas";

// Placeholder text at the end of the import prompt that gets replaced with user content.
const CONTENT_PLACEHOLDER =
  "[PASTE YOUR TRAVEL CONTENT HERE — PDF text, booking confirmation email, itinerary, etc.]";

// Extra instructions injected before the content section so Claude knows it can search the web.
const WEB_TOOLS_INSTRUCTIONS =
  "\nADDITIONAL CAPABILITIES: You have WebSearch and WebFetch tools available. Use them proactively to fill in missing details — e.g. if a hotel lacks an address or city, search for it; if a flight uses a city name instead of an IATA code, verify it. Prioritize the provided content over web results.\n";

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

  // Build the full prompt: instructions + web tools note + user content embedded in place
  // of the placeholder. Sent as a single `prompt` field — system_prompt is left empty
  // to avoid AgentOS's internal size limits on that field.
  const basePrompt = generateImportPrompt(options);
  const fullPrompt = basePrompt.replace(
    CONTENT_PLACEHOLDER,
    WEB_TOOLS_INSTRUCTIONS + "\n" + content,
  );

  let res: Response;
  try {
    res = await fetch(`${agentosUrl}/api/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agentosKey}`,
      },
      body: JSON.stringify({
        prompt: fullPrompt,
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
