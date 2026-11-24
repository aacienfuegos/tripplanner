"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/action-auth";
import { createManualClient } from "@/lib/oauth/clients";
import { deleteManualClient, revokeUserGrant } from "@/lib/oauth/grants";

export type AgentActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: "not_found" | "invalid_name" | "invalid_redirect_uri" | "limit" };

function refresh() {
  revalidatePath("/profile/agents");
  revalidatePath("/profile");
}

// The owner is always the session's: the id alone never reaches someone
// else's connection or client.
export async function revokeAgentConnection(grantId: string): Promise<AgentActionResult> {
  const userId = await requireUser();
  const revoked = typeof grantId === "string" && (await revokeUserGrant(userId, grantId, new Date()));
  refresh();
  return revoked ? { ok: true } : { ok: false, error: "not_found" };
}

export async function createAgentClient(input: { name: string; redirectUri: string }): Promise<AgentActionResult> {
  const userId = await requireUser();
  const result = await createManualClient(userId, input);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function deleteAgentClient(clientId: string): Promise<AgentActionResult> {
  const userId = await requireUser();
  const deleted = typeof clientId === "string" && (await deleteManualClient(userId, clientId, new Date()));
  refresh();
  return deleted ? { ok: true } : { ok: false, error: "not_found" };
}
