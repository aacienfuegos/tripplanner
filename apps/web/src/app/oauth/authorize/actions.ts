"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/action-auth";
import { getOAuthConfig } from "@/lib/oauth/config";
import { consentInputFromForm, decideConsent, type ConsentError } from "@/lib/oauth/consent";

export type ConsentState = { readonly error: ConsentError | "unavailable" } | null;

// requireUser re-reads the status: only an approved user gets this far.
export async function submitConsent(_previous: ConsentState, formData: FormData): Promise<ConsentState> {
  const userId = await requireUser();
  const config = getOAuthConfig();
  if (!config) return { error: "unavailable" };
  const result = await decideConsent(config, userId, consentInputFromForm(formData));
  if ("error" in result) return { error: result.error };
  redirect(result.location);
}
