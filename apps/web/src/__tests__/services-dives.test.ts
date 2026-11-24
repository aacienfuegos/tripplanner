import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dives from "@/lib/services/dives";
import * as diveSites from "@/lib/services/dive-sites";
import * as diveEquipment from "@/lib/services/dive-equipment";
import * as diveCertifications from "@/lib/services/dive-certifications";
import { NotFoundError } from "@/lib/services/errors";
import { A, B, fakeServiceDb, seedTwoUsers } from "./helpers/fake-service-db";
import { agentActor, webActorOf } from "./helpers/actors";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-service-db")).fakeServicePrisma }));
vi.mock("@/lib/geocode-items", () => ({ geocodeDiveSite: vi.fn() }));

const dive = { date: "2026-08-01", time: "10:30", depthMax: 18.5, bottomTime: 45 };

beforeEach(() => {
  seedTwoUsers();
});

async function expectNotFoundWithoutWrite(run: () => Promise<unknown>) {
  const before = fakeServiceDb.dump();
  await expect(run()).rejects.toThrow(NotFoundError);
  expect(fakeServiceDb.dump()).toEqual(before);
}

const diveRow = (id: string) => fakeServiceDb.rows("diveLog").find((d) => d.id === id);

describe.each([
  [A, B],
  [B, A],
])("as an agent of %s, with the ids of %s", (me, other) => {
  // The connection reaches trip-<me> and not trip-<me>-2.
  const agent = () => agentActor(me, [`trip-${me}`]);

  it("creates a dive with no trip in an existing site, numbered like one from the web (CA14)", async () => {
    const created = await dives.createDiveLog(agent(), { ...dive, diveSiteId: `site-${me}` });

    expect(diveRow(created.id)).toMatchObject({
      userId: me,
      tripId: null,
      diveSiteId: `site-${me}`,
      gasMix: "AIR",
      date: new Date("2026-08-01T10:30:00"),
    });
    expect(diveRow(created.id)?.diveNumber).toBeGreaterThan(0);
  });

  it("links a new dive to a trip of its connection (CA14)", async () => {
    const created = await dives.createDiveLog(agent(), { ...dive, tripId: `trip-${me}` });

    expect(diveRow(created.id)).toMatchObject({ tripId: `trip-${me}` });
  });

  it("gets not found for a trip outside its connection or another user's, and writes nothing (CA14)", async () => {
    for (const tripId of [`trip-${me}-2`, `trip-${other}`]) {
      await expectNotFoundWithoutWrite(() => dives.createDiveLog(agent(), { ...dive, tripId }));
      await expectNotFoundWithoutWrite(() => dives.updateDiveLog(agent(), `dive-${me}`, { tripId }));
      await expectNotFoundWithoutWrite(() => dives.linkDiveToTrip(agent(), `dive-${me}`, tripId));
    }
  });

  it("can't move or unlink a dive from a trip outside its connection", async () => {
    const inTrip2 = `dive-${me}-in-trip-2`;

    await expectNotFoundWithoutWrite(() => dives.unlinkDiveFromTrip(agent(), inTrip2));
    await expectNotFoundWithoutWrite(() => dives.linkDiveToTrip(agent(), inTrip2, `trip-${me}`));
    await expectNotFoundWithoutWrite(() => dives.updateDiveLog(agent(), inTrip2, { tripId: null }));
    await expectNotFoundWithoutWrite(() => dives.updateDiveLog(agent(), inTrip2, { tripId: `trip-${me}` }));
  });

  it("still edits other fields of a dive linked to a trip outside its connection", async () => {
    await dives.updateDiveLog(agent(), `dive-${me}-in-trip-2`, { notes: "Mantas" });

    expect(diveRow(`dive-${me}-in-trip-2`)).toMatchObject({ notes: "Mantas", tripId: `trip-${me}-2` });
  });

  it("links, and unlinks, a dive within its connection", async () => {
    await dives.linkDiveToTrip(agent(), `dive-${me}`, `trip-${me}`);
    expect(diveRow(`dive-${me}`)).toMatchObject({ tripId: `trip-${me}` });

    await dives.unlinkDiveFromTrip(agent(), `dive-${me}`);
    expect(diveRow(`dive-${me}`)).toMatchObject({ tripId: null });
  });

  it("rejects another user's site, area and equipment instead of dropping them", async () => {
    await expectNotFoundWithoutWrite(() => dives.createDiveLog(agent(), { ...dive, diveSiteId: `site-${other}` }));
    await expectNotFoundWithoutWrite(() => dives.createDiveLog(agent(), { ...dive, equipmentIds: [`eq-${me}`, `eq-${other}`] }));
    await expectNotFoundWithoutWrite(() => dives.updateDiveLog(agent(), `dive-${me}`, { diveSiteId: `site-${other}` }));
    await expectNotFoundWithoutWrite(() => diveSites.createDiveSite(agent(), { name: "Bajo", diveAreaId: `area-${other}` }));
    await expectNotFoundWithoutWrite(() => diveSites.updateDiveSite(agent(), `site-${me}`, { diveAreaId: `area-${other}` }));
    await expectNotFoundWithoutWrite(() =>
      diveEquipment.createDiveEquipmentService(agent(), { equipmentId: `eq-${other}`, date: "2026-05-01", description: "Revisión" }),
    );
  });

  it("gets not found editing or deleting a dive, site, area, equipment, service or certification of the other user (CA6)", async () => {
    const actor = agent();
    const runs = [
      () => dives.updateDiveLog(actor, `dive-${other}`, { notes: "x" }),
      () => dives.updateDiveLog(actor, `dive-${other}`, { tripId: `trip-${me}` }),
      () => dives.deleteDiveLog(actor, `dive-${other}`),
      () => dives.linkDiveToTrip(actor, `dive-${other}`, `trip-${me}`),
      () => dives.unlinkDiveFromTrip(actor, `dive-${other}-in-trip-2`),
      () => diveSites.updateDiveSite(actor, `site-${other}`, { notes: "x" }),
      () => diveSites.deleteDiveSite(actor, `site-${other}`),
      () => diveSites.updateDiveArea(actor, `area-${other}`, { notes: "x" }),
      () => diveSites.deleteDiveArea(actor, `area-${other}`),
      () => diveEquipment.updateDiveEquipment(actor, `eq-${other}`, { notes: "x" }),
      () => diveEquipment.deleteDiveEquipment(actor, `eq-${other}`),
      () => diveEquipment.deleteDiveEquipmentService(actor, `svc-${other}`),
      () => diveCertifications.updateDiveCertification(actor, `cert-${other}`, { notes: "x" }),
      () => diveCertifications.deleteDiveCertification(actor, `cert-${other}`),
    ];
    for (const run of runs) await expectNotFoundWithoutWrite(run);
  });

  it("creates a certification and an equipment service for its user (CA14)", async () => {
    const cert = await diveCertifications.createDiveCertification(agent(), { agency: "PADI", level: "Advanced", issueDate: "2025-09-12" });
    const service = await diveEquipment.createDiveEquipmentService(agent(), {
      equipmentId: `eq-${me}`,
      date: "2026-05-01",
      description: "Revisión anual",
      cost: 59.9,
    });

    expect(cert).toMatchObject({ userId: me, agency: "PADI", issueDate: new Date("2025-09-12") });
    expect(service).toMatchObject({ userId: me, equipmentId: `eq-${me}`, cost: 59.9, date: new Date("2026-05-01") });
  });
});

describe("the web keeps what it did", () => {
  it("stores null for a trip, a site or equipment that isn't the user's", async () => {
    const created = await dives.createDiveLog(webActorOf(A), {
      ...dive,
      tripId: `trip-${B}`,
      diveSiteId: `site-${B}`,
      equipmentIds: [`eq-${A}`, `eq-${B}`],
    });

    expect(diveRow(created.id)).toMatchObject({
      tripId: null,
      diveSiteId: null,
      equipment: { connect: [{ id: `eq-${A}` }] },
    });
  });

  it("drops an area that isn't the user's when editing a site", async () => {
    await diveSites.updateDiveSite(webActorOf(A), `site-${A}`, { name: "Bajo", diveAreaId: `area-${B}` });

    expect(fakeServiceDb.rows("diveSite").find((s) => s.id === `site-${A}`)).toMatchObject({ diveAreaId: null });
  });
});

describe("partial dive edits", () => {
  it("a new time keeps the stored day, and a new day keeps the stored time", async () => {
    const created = await dives.createDiveLog(agentActor(A, "all"), dive);

    await dives.updateDiveLog(agentActor(A, "all"), created.id, { time: "16:05" });
    expect(diveRow(created.id)?.date).toEqual(new Date("2026-08-01T16:05:00"));

    await dives.updateDiveLog(agentActor(A, "all"), created.id, { date: "2026-08-03" });
    expect(diveRow(created.id)?.date).toEqual(new Date("2026-08-03T16:05:00"));
  });

  it("clears the coordinates of a site only when its address changes", async () => {
    const site = () => fakeServiceDb.rows("diveSite").find((s) => s.id === `site-${A}`);
    Object.assign(site() ?? {}, { address: "Cabo de Palos", latitude: 37.6, longitude: -0.7 });

    await diveSites.updateDiveSite(agentActor(A, "all"), `site-${A}`, { notes: "Corriente" });
    expect(site()).toMatchObject({ latitude: 37.6 });

    await diveSites.updateDiveSite(agentActor(A, "all"), `site-${A}`, { address: "Isla Grosa" });
    expect(site()).toMatchObject({ address: "Isla Grosa", latitude: null, longitude: null });
  });
});
