import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { apiRequest, jsonRequest } from "./helpers/api-request";

vi.mock("server-only", () => ({}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const geocodeActivity = vi.fn();
const geocodeAccommodation = vi.fn();
vi.mock("@/lib/geocode-items", () => ({
  geocodeActivity: (...args: unknown[]) => geocodeActivity(...args),
  geocodeAccommodation: (...args: unknown[]) => geocodeAccommodation(...args),
}));

const apiTokenFindUnique = vi.fn();
const usageCreate = vi.fn();
const tripFindFirst = vi.fn();
const tripFindMany = vi.fn();
const tripFindUnique = vi.fn();
const activityCreate = vi.fn();
const activityUpdate = vi.fn();
const accommodationCreate = vi.fn();
const accommodationUpdate = vi.fn();
const equipmentCreate = vi.fn();
const equipmentUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiToken: {
      findUnique: (...args: unknown[]) => apiTokenFindUnique(...args),
      update: () => Promise.resolve({}),
    },
    apiTokenUsage: {
      create: (...args: unknown[]) => usageCreate(...args),
      deleteMany: () => Promise.resolve({ count: 0 }),
    },
    trip: {
      findFirst: (...args: unknown[]) => tripFindFirst(...args),
      findMany: (...args: unknown[]) => tripFindMany(...args),
      findUnique: (...args: unknown[]) => tripFindUnique(...args),
    },
    activity: {
      create: (...args: unknown[]) => activityCreate(...args),
      update: (...args: unknown[]) => activityUpdate(...args),
    },
    accommodation: {
      create: (...args: unknown[]) => accommodationCreate(...args),
      update: (...args: unknown[]) => accommodationUpdate(...args),
    },
    diveEquipment: {
      create: (...args: unknown[]) => equipmentCreate(...args),
      update: (...args: unknown[]) => equipmentUpdate(...args),
    },
    $transaction: (ops: unknown[]) => Promise.all(ops),
  },
}));

import { GET as listTrips } from "@/app/api/v1/trips/route";
import { GET as getTrip } from "@/app/api/v1/trips/[tripId]/route";
import { POST as createActivity } from "@/app/api/v1/trips/[tripId]/activities/route";
import { PATCH as updateActivity } from "@/app/api/v1/trips/[tripId]/activities/[activityId]/route";
import { POST as createAccommodation } from "@/app/api/v1/trips/[tripId]/accommodations/route";
import { PATCH as updateAccommodation } from "@/app/api/v1/trips/[tripId]/accommodations/[accommodationId]/route";
import { POST as createEquipment } from "@/app/api/v1/equipment/route";
import { PATCH as updateEquipment } from "@/app/api/v1/equipment/[equipmentId]/route";
import {
  ACCOMMODATION_SELECT,
  ACTIVITY_SELECT,
  DESTINATION_SELECT,
  EQUIPMENT_SELECT,
  TRIP_DETAIL_SELECT,
  TRIP_LIST_SELECT,
} from "@/lib/api-selects";

const TOKEN = `tp_${"Z".repeat(43)}`;
const BASE = "http://localhost/api/v1";
const ALL_SCOPES = ["TRIPS_READ", "ACTIVITIES_WRITE", "ACCOMMODATIONS_WRITE", "EQUIPMENT_WRITE"];

const params = <P>(value: P) => ({ params: Promise.resolve(value) });
const tripParams = params({ tripId: "trip-1" });
const activityParams = params({ tripId: "trip-1", activityId: "act-1" });
const accommodationParams = params({ tripId: "trip-1", accommodationId: "acc-1" });

function authenticateAs(userId: string, scopes: string[] = ALL_SCOPES) {
  apiTokenFindUnique.mockResolvedValue({
    id: `tok-${userId}`,
    userId,
    scopes,
    expiresAt: null,
    revokedAt: null,
    user: { status: "APPROVED" },
  });
}

function getRequest(path: string): Request {
  return apiRequest({ url: `${BASE}${path}`, headers: { authorization: `Bearer ${TOKEN}` } });
}

const lastUsage = () => usageCreate.mock.calls.at(-1)?.[0].data;

function notFoundError() {
  return new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "7.10.0" });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticateAs("user-1");
  usageCreate.mockResolvedValue({});
  tripFindFirst.mockResolvedValue({ id: "trip-1" });
  tripFindMany.mockResolvedValue([]);
  tripFindUnique.mockResolvedValue({ id: "trip-1" });
  activityCreate.mockResolvedValue({ id: "act-new" });
  activityUpdate.mockResolvedValue({ id: "act-1" });
  accommodationCreate.mockResolvedValue({ id: "acc-new" });
  accommodationUpdate.mockResolvedValue({ id: "acc-1" });
  equipmentCreate.mockResolvedValue({ id: "eq-new" });
  equipmentUpdate.mockResolvedValue({ id: "eq-1" });
});

describe("GET /api/v1/trips", () => {
  it.each([["user-a"], ["user-b"]])("only lists the trips of the token's user (%s)", async (userId) => {
    authenticateAs(userId);
    const response = await listTrips(getRequest("/trips"), params({}));
    expect(response.status).toBe(200);
    expect(tripFindMany).toHaveBeenCalledWith({
      where: { userId },
      select: TRIP_LIST_SELECT,
      orderBy: { startDate: "desc" },
    });
  });

  it("sends Cache-Control: no-store on a 200", async () => {
    const response = await listTrips(getRequest("/trips"), params({}));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("logs a GET with no fields and no resourceId", async () => {
    await listTrips(getRequest("/trips"), params({}));
    expect(lastUsage()).toMatchObject({ method: "GET", status: 200, fields: [], resourceId: null });
  });
});

describe("ownership", () => {
  beforeEach(() => tripFindFirst.mockResolvedValue(null));

  it("returns 404 for another user's trip detail", async () => {
    const response = await getTrip(getRequest("/trips/trip-1"), tripParams);
    expect(response.status).toBe(404);
    expect(tripFindFirst).toHaveBeenCalledWith({ where: { id: "trip-1", userId: "user-1" }, select: { id: true } });
    expect(tripFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 on POST to another user's trip without creating", async () => {
    const response = await createActivity(
      jsonRequest("POST", `${BASE}/trips/trip-1/activities`, TOKEN, { name: "Museo" }),
      tripParams,
    );
    expect(response.status).toBe(404);
    expect(activityCreate).not.toHaveBeenCalled();
    expect(lastUsage()).toMatchObject({ status: 404, fields: [], resourceId: null });
  });

  it("returns 404 on PATCH in another user's trip without updating", async () => {
    const response = await updateAccommodation(
      jsonRequest("PATCH", `${BASE}/trips/trip-1/accommodations/acc-1`, TOKEN, { price: 10 }),
      accommodationParams,
    );
    expect(response.status).toBe(404);
    expect(accommodationUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 for an activity of another trip", async () => {
    tripFindFirst.mockResolvedValue({ id: "trip-1" });
    activityUpdate.mockRejectedValue(notFoundError());
    const response = await updateActivity(
      jsonRequest("PATCH", `${BASE}/trips/trip-1/activities/act-other`, TOKEN, { price: 10 }),
      params({ tripId: "trip-1", activityId: "act-other" }),
    );
    expect(response.status).toBe(404);
    expect(activityUpdate.mock.calls[0][0].where).toEqual({ id: "act-other", tripId: "trip-1" });
    expect(lastUsage()).toMatchObject({ status: 404, fields: [], resourceId: null });
  });

  it("returns 404 for another user's equipment", async () => {
    equipmentUpdate.mockRejectedValue(notFoundError());
    const response = await updateEquipment(
      jsonRequest("PATCH", `${BASE}/equipment/eq-9`, TOKEN, { size: "L" }),
      params({ equipmentId: "eq-9" }),
    );
    expect(response.status).toBe(404);
    expect(equipmentUpdate.mock.calls[0][0].where).toEqual({ id: "eq-9", userId: "user-1" });
  });
});

describe("validation", () => {
  it("returns 422 for an extra field", async () => {
    const response = await createActivity(
      jsonRequest("POST", `${BASE}/trips/trip-1/activities`, TOKEN, { name: "Museo", tripId: "trip-2" }),
      tripParams,
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.issues[0]).toEqual({ path: [], message: expect.any(String) });
    expect(activityCreate).not.toHaveBeenCalled();
    expect(lastUsage()).toMatchObject({ status: 422, fields: [], resourceId: null });
  });

  it("returns 422 for a wrong type without echoing the value", async () => {
    const response = await createEquipment(
      jsonRequest("POST", `${BASE}/equipment`, TOKEN, { name: "Ala", category: "BCD", purchasePrice: "secreto-123" }),
      params({}),
    );
    expect(response.status).toBe(422);
    const text = JSON.stringify(await response.json());
    expect(text).toContain("purchasePrice");
    expect(text).not.toContain("secreto-123");
  });

  it("returns 422 for PATCH {} without touching Prisma or revalidatePath", async () => {
    const activity = await updateActivity(
      jsonRequest("PATCH", `${BASE}/trips/trip-1/activities/act-1`, TOKEN, {}),
      activityParams,
    );
    const equipment = await updateEquipment(
      jsonRequest("PATCH", `${BASE}/equipment/eq-1`, TOKEN, {}),
      params({ equipmentId: "eq-1" }),
    );
    expect(activity.status).toBe(422);
    expect(equipment.status).toBe(422);
    expect(activityUpdate).not.toHaveBeenCalled();
    expect(equipmentUpdate).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["bookingRef", "ABC123"],
    ["confirmationUrl", "https://phishing.example/reserva"],
    ["notes", "nuevo texto"],
  ])("returns 422 when a PATCH carries %s", async (field, value) => {
    const activity = await updateActivity(
      jsonRequest("PATCH", `${BASE}/trips/trip-1/activities/act-1`, TOKEN, { [field]: value }),
      activityParams,
    );
    const accommodation = await updateAccommodation(
      jsonRequest("PATCH", `${BASE}/trips/trip-1/accommodations/acc-1`, TOKEN, { [field]: value }),
      accommodationParams,
    );
    expect(activity.status).toBe(422);
    expect(accommodation.status).toBe(422);
    expect(activityUpdate).not.toHaveBeenCalled();
    expect(accommodationUpdate).not.toHaveBeenCalled();
  });

  it("accepts bookingRef, confirmationUrl and notes on POST", async () => {
    const createOnly = { bookingRef: "ABC123", confirmationUrl: "https://hotel.example/r", notes: "Llegada tarde" };
    const activity = await createActivity(
      jsonRequest("POST", `${BASE}/trips/trip-1/activities`, TOKEN, { name: "Cena", ...createOnly }),
      tripParams,
    );
    const accommodation = await createAccommodation(
      jsonRequest("POST", `${BASE}/trips/trip-1/accommodations`, TOKEN, { name: "Hotel", city: "Lisboa", ...createOnly }),
      tripParams,
    );
    expect(activity.status).toBe(201);
    expect(accommodation.status).toBe(201);
    expect(activityCreate.mock.calls[0][0].data).toMatchObject(createOnly);
    expect(accommodationCreate.mock.calls[0][0].data).toMatchObject(createOnly);
  });

  it("returns 400 for malformed JSON", async () => {
    const body = "{ not json";
    const request = apiRequest({
      method: "POST",
      url: `${BASE}/trips/trip-1/activities`,
      headers: { authorization: `Bearer ${TOKEN}`, "content-length": String(body.length) },
      body,
    });
    const response = await createActivity(request, tripParams);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_JSON");
  });
});

describe("body size limit", () => {
  const unreadableBody = () =>
    new ReadableStream<Uint8Array>({
      pull() {
        throw new Error("the body must not be read");
      },
    });

  it("returns 413 for a Content-Length above 64 KB without reading the body", async () => {
    const request = apiRequest({
      method: "POST",
      url: `${BASE}/equipment`,
      headers: { authorization: `Bearer ${TOKEN}`, "content-length": String(64 * 1024 + 1) },
      body: unreadableBody(),
    });
    const response = await createEquipment(request, params({}));
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("returns 413 without Content-Length", async () => {
    const request = apiRequest({
      method: "POST",
      url: `${BASE}/equipment`,
      headers: { authorization: `Bearer ${TOKEN}` },
      body: unreadableBody(),
    });
    const response = await createEquipment(request, params({}));
    expect(response.status).toBe(413);
  });

  it("returns 413 when the real body exceeds 64 KB despite a smaller header", async () => {
    const body = JSON.stringify({ name: "Ala", category: "BCD", notes: "x".repeat(70 * 1024) });
    const request = apiRequest({
      method: "POST",
      url: `${BASE}/equipment`,
      headers: { authorization: `Bearer ${TOKEN}`, "content-length": "100" },
      body,
    });
    const response = await createEquipment(request, params({}));
    expect(response.status).toBe(413);
    expect(equipmentCreate).not.toHaveBeenCalled();
  });
});

describe("writes", () => {
  it("creates an activity in the owned trip with the scoped data", async () => {
    const response = await createActivity(
      jsonRequest("POST", `${BASE}/trips/trip-1/activities`, TOKEN, {
        name: "Museo",
        city: "Lisboa",
        scheduledAt: "2026-11-03T10:00",
        price: 12.5,
      }),
      tripParams,
    );
    expect(response.status).toBe(201);
    expect(tripFindFirst).toHaveBeenCalledWith({ where: { id: "trip-1", userId: "user-1" }, select: { id: true } });
    expect(activityCreate).toHaveBeenCalledWith({
      data: {
        tripId: "trip-1",
        name: "Museo",
        city: "Lisboa",
        scheduledAt: new Date("2026-11-03T10:00"),
        price: 12.5,
        type: "ACTIVITY",
        status: "PENDING",
      },
      select: ACTIVITY_SELECT,
    });
    expect(geocodeActivity).toHaveBeenCalledWith("act-new");
    expect(revalidatePath).toHaveBeenCalledWith("/trips/trip-1/activities");
  });

  it("logs the created id as resourceId", async () => {
    const response = await createActivity(
      jsonRequest("POST", `${BASE}/trips/trip-1/activities`, TOKEN, { name: "Museo" }),
      tripParams,
    );
    expect(await response.json()).toEqual({ id: "act-new" });
    expect(lastUsage()).toMatchObject({ status: 201, resourceId: "act-new" });
  });

  it("creates equipment for the token's user", async () => {
    const response = await createEquipment(
      jsonRequest("POST", `${BASE}/equipment`, TOKEN, { name: "Traje 5 mm", category: "WETSUIT", purchaseDate: "2026-09-01" }),
      params({}),
    );
    expect(response.status).toBe(201);
    expect(equipmentCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        name: "Traje 5 mm",
        category: "WETSUIT",
        status: "OWNED",
        purchaseDate: new Date("2026-09-01"),
      },
      select: EQUIPMENT_SELECT,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dives");
    expect(lastUsage()).toMatchObject({ resourceId: "eq-new" });
  });

  it("does not send type or status on a PATCH with only name", async () => {
    await updateActivity(
      jsonRequest("PATCH", `${BASE}/trips/trip-1/activities/act-1`, TOKEN, { name: "Otro" }),
      activityParams,
    );
    const { data } = activityUpdate.mock.calls[0][0];
    expect(data).not.toHaveProperty("type");
    expect(data).not.toHaveProperty("status");
  });

  it("resets coordinates and geocodes when a PATCH changes city", async () => {
    await updateActivity(
      jsonRequest("PATCH", `${BASE}/trips/trip-1/activities/act-1`, TOKEN, { city: "Oporto" }),
      activityParams,
    );
    expect(activityUpdate.mock.calls[0][0].data).toEqual({ city: "Oporto", latitude: null, longitude: null });
    expect(geocodeActivity).toHaveBeenCalledWith("act-1");
  });

  it("keeps coordinates and skips geocoding when a PATCH only changes price", async () => {
    await updateActivity(
      jsonRequest("PATCH", `${BASE}/trips/trip-1/activities/act-1`, TOKEN, { price: 20 }),
      activityParams,
    );
    expect(activityUpdate.mock.calls[0][0].data).toEqual({ price: 20 });
    expect(geocodeActivity).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/trips/trip-1/activities");
  });

  it("resets coordinates of an accommodation when a PATCH changes address", async () => {
    await updateAccommodation(
      jsonRequest("PATCH", `${BASE}/trips/trip-1/accommodations/acc-1`, TOKEN, { address: "Rua 1" }),
      accommodationParams,
    );
    expect(accommodationUpdate.mock.calls[0][0].data).toEqual({ address: "Rua 1", latitude: null, longitude: null });
    expect(geocodeAccommodation).toHaveBeenCalledWith("acc-1");
  });

  it("logs the field names and the id of a PATCH, never the values", async () => {
    await updateActivity(
      jsonRequest("PATCH", `${BASE}/trips/trip-1/activities/act-1`, TOKEN, { price: 99, city: "Valor-Secreto" }),
      activityParams,
    );
    const usage = lastUsage();
    expect(usage).toMatchObject({ method: "PATCH", status: 200, resourceId: "act-1" });
    expect([...usage.fields].sort()).toEqual(["city", "price"]);
    expect(JSON.stringify(usage)).not.toContain("Valor-Secreto");
    expect(JSON.stringify(usage)).not.toContain("99");
  });

  it("revalidates the equipment detail on PATCH", async () => {
    const response = await updateEquipment(
      jsonRequest("PATCH", `${BASE}/equipment/eq-1`, TOKEN, { serialNumber: "SN-1", purchasePrice: 300 }),
      params({ equipmentId: "eq-1" }),
    );
    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/dives");
    expect(revalidatePath).toHaveBeenCalledWith("/dives/equipment/eq-1");
  });

  it("returns 403 for a write without its scope", async () => {
    authenticateAs("user-1", ["TRIPS_READ", "ACTIVITIES_WRITE"]);
    const response = await createEquipment(
      jsonRequest("POST", `${BASE}/equipment`, TOKEN, { name: "Ala", category: "BCD" }),
      params({}),
    );
    expect(response.status).toBe(403);
    expect(equipmentCreate).not.toHaveBeenCalled();
  });
});

describe("response fields", () => {
  it("passes the closed select constant to every Prisma call of the 8 routes", async () => {
    await listTrips(getRequest("/trips"), params({}));
    await getTrip(getRequest("/trips/trip-1"), tripParams);
    await createActivity(jsonRequest("POST", `${BASE}/trips/trip-1/activities`, TOKEN, { name: "A" }), tripParams);
    await updateActivity(
      jsonRequest("PATCH", `${BASE}/trips/trip-1/activities/act-1`, TOKEN, { name: "B" }),
      activityParams,
    );
    await createAccommodation(
      jsonRequest("POST", `${BASE}/trips/trip-1/accommodations`, TOKEN, { name: "H", city: "C" }),
      tripParams,
    );
    await updateAccommodation(
      jsonRequest("PATCH", `${BASE}/trips/trip-1/accommodations/acc-1`, TOKEN, { price: 1 }),
      accommodationParams,
    );
    await createEquipment(jsonRequest("POST", `${BASE}/equipment`, TOKEN, { name: "Ala", category: "BCD" }), params({}));
    await updateEquipment(jsonRequest("PATCH", `${BASE}/equipment/eq-1`, TOKEN, { size: "M" }), params({ equipmentId: "eq-1" }));

    expect(tripFindMany.mock.calls[0][0].select).toBe(TRIP_LIST_SELECT);
    expect(tripFindUnique.mock.calls[0][0].select).toBe(TRIP_DETAIL_SELECT);
    expect(activityCreate.mock.calls[0][0].select).toBe(ACTIVITY_SELECT);
    expect(activityUpdate.mock.calls[0][0].select).toBe(ACTIVITY_SELECT);
    expect(accommodationCreate.mock.calls[0][0].select).toBe(ACCOMMODATION_SELECT);
    expect(accommodationUpdate.mock.calls[0][0].select).toBe(ACCOMMODATION_SELECT);
    expect(equipmentCreate.mock.calls[0][0].select).toBe(EQUIPMENT_SELECT);
    expect(equipmentUpdate.mock.calls[0][0].select).toBe(EQUIPMENT_SELECT);
    for (const call of tripFindFirst.mock.calls) expect(call[0].select).toEqual({ id: true });
  });

  function keysDeep(select: object): string[] {
    return Object.entries(select).flatMap(([key, value]) =>
      value !== null && typeof value === "object" ? [key, ...keysDeep(value)] : [key],
    );
  }

  it.each([
    ["TRIP_LIST_SELECT", TRIP_LIST_SELECT],
    ["TRIP_DETAIL_SELECT", TRIP_DETAIL_SELECT],
    ["DESTINATION_SELECT", DESTINATION_SELECT],
    ["ACTIVITY_SELECT", ACTIVITY_SELECT],
    ["ACCOMMODATION_SELECT", ACCOMMODATION_SELECT],
    ["EQUIPMENT_SELECT", EQUIPMENT_SELECT],
  ])("%s never selects private fields", (_name, select) => {
    const keys = keysDeep(select);
    for (const forbidden of ["userId", "tripId", "bookingRef", "confirmationUrl", "serialNumber", "purchasePrice"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("does not select notes of activities or accommodations, also inside the trip detail", () => {
    expect(keysDeep(ACTIVITY_SELECT)).not.toContain("notes");
    expect(keysDeep(ACCOMMODATION_SELECT)).not.toContain("notes");
    expect(keysDeep(TRIP_DETAIL_SELECT.activities.select)).not.toContain("notes");
    expect(keysDeep(TRIP_DETAIL_SELECT.accommodations.select)).not.toContain("notes");
  });
});
