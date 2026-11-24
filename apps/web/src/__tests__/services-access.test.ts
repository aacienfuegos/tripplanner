import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import {
  requireTrip,
  requireSuitcase,
  resolveDiveAreaId,
  resolveDiveSiteId,
  resolveDiveTripId,
  resolveEquipmentIds,
  requireEquipment,
} from "@/lib/services/access";
import { redirectIfTripNotFound } from "@/lib/services/actor";
import { InputError, NotFoundError, orNotFound, parseInput } from "@/lib/services/errors";
import { A, B, seedTwoUsers } from "./helpers/fake-service-db";
import { agentActor, webActorOf } from "./helpers/actors";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-service-db")).fakeServicePrisma }));

beforeEach(() => {
  seedTwoUsers();
});

// Every case runs as A with B's ids and as B with A's: an owner fixed in the
// code would fail one of the two rounds.
describe.each([
  [A, B],
  [B, A],
])("as %s, with the ids of %s", (me, other) => {
  describe("requireTrip", () => {
    it("returns the user's own trip with its currency", async () => {
      await expect(requireTrip(webActorOf(me), `trip-${me}`)).resolves.toEqual({ id: `trip-${me}`, currency: "EUR" });
    });

    it("gives NotFoundError for another user's trip, as for one that doesn't exist (CA6)", async () => {
      for (const actor of [webActorOf(me), agentActor(me, "all"), agentActor(me, [`trip-${other}`])]) {
        await expect(requireTrip(actor, `trip-${other}`)).rejects.toThrow(NotFoundError);
        await expect(requireTrip(actor, "trip-missing")).rejects.toThrow(NotFoundError);
      }
    });

    it("lets an agent reach only the trips of its list (CA13)", async () => {
      const actor = agentActor(me, [`trip-${me}`]);

      await expect(requireTrip(actor, `trip-${me}`)).resolves.toMatchObject({ id: `trip-${me}` });
      await expect(requireTrip(actor, `trip-${me}-2`)).rejects.toThrow(NotFoundError);
    });

    it("lets an agent with all trips reach every trip of its user", async () => {
      const actor = agentActor(me, "all");

      await expect(requireTrip(actor, `trip-${me}`)).resolves.toMatchObject({ id: `trip-${me}` });
      await expect(requireTrip(actor, `trip-${me}-2`)).resolves.toMatchObject({ id: `trip-${me}-2` });
    });
  });

  describe("requireSuitcase", () => {
    it("accepts no bag and a bag of the trip, and rejects a bag of another trip", async () => {
      await expect(requireSuitcase(`trip-${me}`, null)).resolves.toBeUndefined();
      await expect(requireSuitcase(`trip-${me}`, `bag-${me}`)).resolves.toBeUndefined();
      await expect(requireSuitcase(`trip-${me}`, `bag-${other}`)).rejects.toThrow("Suitcase not found");
    });
  });

  describe("diving references", () => {
    const resolvers = [
      ["site", resolveDiveSiteId],
      ["area", resolveDiveAreaId],
    ] as const;

    it("keeps the user's own site and area", async () => {
      for (const [kind, resolve] of resolvers) {
        for (const actor of [webActorOf(me), agentActor(me, [])]) {
          await expect(resolve(actor, `${kind}-${me}`)).resolves.toBe(`${kind}-${me}`);
        }
      }
    });

    it("drops another user's site or area on the web, as today", async () => {
      for (const [kind, resolve] of resolvers) {
        await expect(resolve(webActorOf(me), `${kind}-${other}`)).resolves.toBeNull();
      }
    });

    it("gives NotFoundError for another user's site or area with an agent (CA6)", async () => {
      for (const [kind, resolve] of resolvers) {
        await expect(resolve(agentActor(me, "all"), `${kind}-${other}`)).rejects.toThrow(NotFoundError);
      }
    });

    it("drops a trip that isn't the user's on the web, as today", async () => {
      await expect(resolveDiveTripId(webActorOf(me), `trip-${other}`)).resolves.toBeNull();
      await expect(resolveDiveTripId(webActorOf(me), `trip-${me}`)).resolves.toBe(`trip-${me}`);
    });

    it("gives NotFoundError with an agent for a trip outside its connection or another user's (CA14)", async () => {
      const actor = agentActor(me, [`trip-${me}`]);

      await expect(resolveDiveTripId(actor, `trip-${me}`)).resolves.toBe(`trip-${me}`);
      await expect(resolveDiveTripId(actor, `trip-${me}-2`)).rejects.toThrow(NotFoundError);
      await expect(resolveDiveTripId(actor, `trip-${other}`)).rejects.toThrow(NotFoundError);
    });

    it("filters equipment on the web and rejects the whole list with an agent", async () => {
      const ids = [`eq-${me}`, `eq-${other}`];

      await expect(resolveEquipmentIds(webActorOf(me), ids)).resolves.toEqual([`eq-${me}`]);
      await expect(resolveEquipmentIds(agentActor(me, "all"), ids)).rejects.toThrow(NotFoundError);
      await expect(resolveEquipmentIds(agentActor(me, "all"), [`eq-${me}`])).resolves.toEqual([`eq-${me}`]);
    });

    it("requires the equipment of a service to be the user's", async () => {
      for (const actor of [webActorOf(me), agentActor(me, "all")]) {
        await expect(requireEquipment(actor, `eq-${me}`)).resolves.toBeUndefined();
        await expect(requireEquipment(actor, `eq-${other}`)).rejects.toThrow(NotFoundError);
      }
    });
  });
});

describe("errors", () => {
  it("turns Prisma's P2025 into NotFoundError and lets any other error through", async () => {
    const p2025 = Object.assign(new Error("No record was found for an update."), { code: "P2025" });

    await expect(orNotFound("Flight", Promise.reject(p2025))).rejects.toThrow("Flight not found");
    await expect(orNotFound("Flight", Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(orNotFound("Flight", Promise.resolve(1))).resolves.toBe(1);
  });

  it("reports the field that fails", () => {
    const schema = z.object({ link: z.object({ url: z.string().url() }) });

    const error = (() => {
      try {
        parseInput(schema, { link: { url: "nope" } });
      } catch (thrown) {
        return thrown;
      }
    })();

    expect(error).toBeInstanceOf(InputError);
    expect(error).toMatchObject({ field: "link.url" });
  });

  it("redirects a trip that isn't found to /trips and lets the rest through", async () => {
    await expect(redirectIfTripNotFound(Promise.reject(new NotFoundError("Trip")))).rejects.toThrow(
      "NEXT_REDIRECT /trips",
    );
    await expect(redirectIfTripNotFound(Promise.reject(new NotFoundError("Flight")))).rejects.toThrow(
      "Flight not found",
    );
  });
});

