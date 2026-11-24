import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/action-auth";
import { NotFoundError } from "@/lib/services/errors";

export const SCOPES = [
  "trips:read",
  "trips:suggest",
  "trips:write",
  "trips:delete",
  "dives:read",
  "dives:write",
  "dives:delete",
  "offline_access",
] as const;

export type Scope = (typeof SCOPES)[number];

export type AgentGrant = {
  readonly id: string;
  readonly allTrips: boolean;
  readonly tripIds: ReadonlySet<string>;
  readonly scopes: ReadonlySet<Scope>;
};

// Who is acting. The services never read the session: the web actions build
// the actor with webActor(), and the token check builds the agent one.
export type Actor =
  | { readonly kind: "web"; readonly userId: string }
  | { readonly kind: "agent"; readonly userId: string; readonly grant: AgentGrant };

export async function webActor(): Promise<Actor> {
  return { kind: "web", userId: await requireUser() };
}

// For the web actions: a trip that isn't the user's still redirects to
// /trips, as requireTripOwner did. Anything else goes up as it is.
export async function redirectIfTripNotFound<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof NotFoundError && error.entity === "Trip") return redirect("/trips");
    throw error;
  }
}
