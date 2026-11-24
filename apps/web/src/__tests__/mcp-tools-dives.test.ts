// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDiveMedia } from "@/lib/dive-media";
import { A, B, fakeServiceDb } from "./helpers/fake-service-db";
import { agentActor } from "./helpers/actors";
import { call, seedForTools } from "./helpers/mcp-tools";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-service-db")).fakeServicePrisma }));
vi.mock("@/lib/geocode-items", () => ({ geocodeDiveSite: vi.fn() }));
vi.mock("@/lib/dive-media", () => ({ getDiveMedia: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  seedForTools();
});

const as = (user: string, trips: readonly string[] | "all") => ({ actor: agentActor(user, trips), mediaAdmin: true });
const dive = (id: string) => fakeServiceDb.rows("diveLog").find((row) => row.id === id);
const notFound = (entity: string) => ({ isError: true, out: { code: "not_found", message: `${entity} not found` } });
const ids = (out: Record<string, unknown>) => (out.items as { id: string }[]).map((item) => item.id);

describe.each([
  [A, B],
  [B, A],
])("the logbook of %s's connection, with the ids of %s", (me, other) => {
  it("logs a dive without a trip at an existing site, numbered among the others (CA14)", async () => {
    const created = await call(as(me, [`trip-${me}`]), "create_dive", {
      date: "2026-05-01",
      time: "11:15",
      depthMax: 22,
      bottomTime: 48,
      diveSiteId: `site-${me}`,
    });
    expect(created.isError).toBe(false);
    expect(created.out.dive).toMatchObject({ date: "2026-05-01", time: "11:15", tripId: null, diveSiteId: `site-${me}` });
    const id = (created.out.dive as { id: string }).id;
    // dive-me (March), this one (May), the one in trip-me-2 (July).
    expect(dive(id)).toMatchObject({ diveNumber: 2, agentGrantId: `grant-${me}` });
  });

  it("links a dive to a trip of the connection; one outside it is not_found, and so is moving it from there (CA14)", async () => {
    const context = as(me, [`trip-${me}`]);
    const linked = await call(context, "link_dive_to_trip", { diveId: `dive-${me}`, tripId: `trip-${me}` });
    expect(linked.out.dive).toMatchObject({ id: `dive-${me}`, tripId: `trip-${me}`, tripName: `Viaje ${me}` });

    const before = fakeServiceDb.dump();
    expect(await call(context, "link_dive_to_trip", { diveId: `dive-${me}`, tripId: `trip-${me}-2` })).toEqual(notFound("Trip"));
    expect(await call(context, "unlink_dive_from_trip", { diveId: `dive-${me}-in-trip-2` })).toEqual(notFound("Trip"));
    expect(
      await call(context, "create_dive", { date: "2026-07-03", depthMax: 10, bottomTime: 30, tripId: `trip-${me}-2` }),
    ).toEqual(notFound("Trip"));
    expect(await call(context, "update_dive", { diveId: `dive-${me}`, tripId: `trip-${me}-2` })).toEqual(notFound("Trip"));
    expect(fakeServiceDb.dump()).toEqual(before);
  });

  it("of a dive in a trip outside the connection, only the tripId comes out", async () => {
    const context = as(me, [`trip-${me}`]);
    const got = await call(context, "get_dive", { diveId: `dive-${me}-in-trip-2` });
    expect(got.out.dive).toMatchObject({ tripId: `trip-${me}-2`, tripName: null });
    expect(JSON.stringify(got.out)).not.toContain(`Otro ${me}`);

    const listed = await call(context, "list_dives", {});
    expect(ids(listed.out)).toEqual([`dive-${me}`, `dive-${me}-in-trip-2`]);
    expect(JSON.stringify(listed.out)).not.toContain(`Otro ${me}`);
    expect(await call(context, "list_dives", { tripId: `trip-${me}-2` })).toEqual(notFound("Trip"));
  });

  it("lists by days, both included", async () => {
    const listed = await call(as(me, "all"), "list_dives", { from: "2026-07-01", to: "2026-07-02" });
    expect(ids(listed.out)).toEqual([`dive-${me}-in-trip-2`]);
  });

  it("logs a certification and a service of its equipment (CA14)", async () => {
    const context = as(me, "all");
    const cert = await call(context, "create_certification", { agency: "SSI", level: "Advanced", issueDate: "2025-09-12" });
    expect(cert.out.certification).toMatchObject({ agency: "SSI", level: "Advanced", issueDate: "2025-09-12" });
    const service = await call(context, "create_equipment_service", {
      equipmentId: `eq-${me}`,
      date: "2026-05-01",
      description: "Cambio de juntas",
      cost: 59.9,
    });
    expect(service.out.service).toMatchObject({ equipmentId: `eq-${me}`, date: "2026-05-01" });
    expect(fakeServiceDb.rows("diveCertification").filter((c) => c.userId === me)).toHaveLength(2);

    const again = await call(context, "create_certification", { agency: "padi", level: "open water" });
    expect(again.out).toMatchObject({ code: "duplicate", existing: { id: `cert-${me}` } });
  });

  it("the other user's dive, site, area, equipment or certification: not_found, and nothing changes (CA6)", async () => {
    const context = as(me, "all");
    const before = fakeServiceDb.dump();
    expect(await call(context, "get_dive", { diveId: `dive-${other}` })).toEqual(notFound("Dive"));
    expect(await call(context, "get_dive", { diveId: "dive-missing" })).toEqual(notFound("Dive"));
    expect(await call(context, "get_dive_profile", { diveId: `dive-${other}` })).toEqual(notFound("Dive"));
    expect(await call(context, "update_dive", { diveId: `dive-${other}`, notes: "x" })).toEqual(notFound("Dive"));
    expect(await call(context, "link_dive_to_trip", { diveId: `dive-${other}`, tripId: `trip-${me}` })).toEqual(
      notFound("Dive"),
    );
    expect(await call(context, "link_dive_to_trip", { diveId: `dive-${me}`, tripId: `trip-${other}` })).toEqual(
      notFound("Trip"),
    );
    expect(await call(context, "update_dive_site", { id: `site-${other}`, name: "x" })).toEqual(notFound("Dive site"));
    expect(await call(context, "update_dive_area", { id: `area-${other}`, name: "x" })).toEqual(notFound("Dive area"));
    expect(await call(context, "update_equipment", { id: `eq-${other}`, name: "x" })).toEqual(notFound("Equipment"));
    expect(await call(context, "update_certification", { id: `cert-${other}`, level: "x" })).toEqual(
      notFound("Certification"),
    );
    expect(
      await call(context, "create_equipment_service", { equipmentId: `eq-${other}`, date: "2026-05-01", description: "x" }),
    ).toEqual(notFound("Equipment"));
    expect(
      await call(context, "create_dive", { date: "2026-05-01", depthMax: 10, bottomTime: 30, diveSiteId: `site-${other}` }),
    ).toEqual(notFound("Dive site"));
    expect(fakeServiceDb.dump()).toEqual(before);
  });

  it("the lists of the logbook are only the user's", async () => {
    const context = as(me, "all");
    expect(ids((await call(context, "list_dive_sites", {})).out)).toEqual([`site-${me}`]);
    expect(ids((await call(context, "list_dive_areas", {})).out)).toEqual([`area-${me}`]);
    expect(ids((await call(context, "list_certifications", {})).out)).toEqual([`cert-${me}`]);
    const equipment = await call(context, "list_equipment", {});
    expect(equipment.out.items).toEqual([
      expect.objectContaining({ id: `eq-${me}`, services: [expect.objectContaining({ id: `svc-${me}` })] }),
    ]);
    const stats = await call(context, "get_dive_stats", {});
    expect(stats.out).toMatchObject({ totalDives: 2 });
  });

  it("the media of a dive is read with the actor's user", async () => {
    vi.mocked(getDiveMedia).mockResolvedValue(null);
    expect(await call(as(me, "all"), "list_dive_media", { diveId: `dive-${other}` })).toEqual(notFound("Dive"));
    expect(getDiveMedia).toHaveBeenCalledWith(me, `dive-${other}`);
  });

  it("attaching a clip needs the dive and the clip to be the user's, and an admin", async () => {
    fakeServiceDb.rows("user").find((user) => user.id === me)!.isAdmin = true;
    fakeServiceDb.rows("mediaClip").push({ id: `clip-${me}`, userId: me }, { id: `clip-${other}`, userId: other });

    expect(
      await call(as(me, "all"), "set_dive_media_link", {
        diveId: `dive-${other}`,
        changes: [{ clipId: `clip-${me}`, included: true }],
      }),
    ).toEqual(notFound("Dive"));
    await call(as(me, "all"), "set_dive_media_link", {
      diveId: `dive-${me}`,
      changes: [
        { clipId: `clip-${me}`, included: true },
        { clipId: `clip-${other}`, included: true },
      ],
    });
    expect(fakeServiceDb.rows("mediaClipLink")).toEqual([
      expect.objectContaining({ clipId: `clip-${me}`, diveLogId: `dive-${me}`, included: true }),
    ]);
    expect(fakeServiceDb.rows("agentAuditEntry").at(-1)).toMatchObject({
      entityType: "Dive",
      entityId: `dive-${me}`,
      changes: { [`clip clip-${me}`]: ["automatic", "included"] },
    });

    fakeServiceDb.rows("user").find((user) => user.id === me)!.isAdmin = false;
    expect(
      await call(as(me, "all"), "set_dive_media_link", { diveId: `dive-${me}`, changes: [{ clipId: `clip-${me}`, included: null }] }),
    ).toEqual(notFound("Media library"));
  });
});
