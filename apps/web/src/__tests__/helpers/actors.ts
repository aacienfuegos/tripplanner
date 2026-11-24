import { SCOPES, type Actor } from "@/lib/services/actor";

export function webActorOf(userId: string): Actor {
  return { kind: "web", userId };
}

// A connection of `userId` with every scope: the services don't look at
// scopes, the trip list is what they check.
export function agentActor(userId: string, trips: readonly string[] | "all"): Actor {
  return {
    kind: "agent",
    userId,
    grant: {
      id: `grant-${userId}`,
      allTrips: trips === "all",
      tripIds: new Set(trips === "all" ? [] : trips),
      scopes: new Set(SCOPES),
    },
  };
}
