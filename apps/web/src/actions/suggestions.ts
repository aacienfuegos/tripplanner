"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirectIfTripNotFound, webActor } from "@/lib/services/actor";
import { InputError, NotFoundError } from "@/lib/services/errors";
import { acceptSuggestion, dismissSuggestion } from "@/lib/services/suggestions";

export type SuggestionResult = { readonly ok: true } | { readonly ok: false; readonly error: "not_found" | "invalid" };

// The trip and the suggestion are looked for among the session user's: an id
// from someone else is "not found" and changes nothing.
async function resolve(work: () => Promise<void>): Promise<SuggestionResult> {
  try {
    await redirectIfTripNotFound(work());
    return { ok: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof NotFoundError) return { ok: false, error: "not_found" };
    if (error instanceof InputError) return { ok: false, error: "invalid" };
    throw error;
  }
}

export async function acceptAgentSuggestion(tripId: string, id: string): Promise<SuggestionResult> {
  const actor = await webActor();
  if (typeof tripId !== "string" || typeof id !== "string") return { ok: false, error: "not_found" };
  return resolve(() => acceptSuggestion(actor, tripId, id));
}

export async function dismissAgentSuggestion(tripId: string, id: string): Promise<SuggestionResult> {
  const actor = await webActor();
  if (typeof tripId !== "string" || typeof id !== "string") return { ok: false, error: "not_found" };
  return resolve(() => dismissSuggestion(actor, tripId, id));
}
