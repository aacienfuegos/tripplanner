import { matchesWhere, nextId, table } from "./fake-packing-db";

// In-memory stand-in for the models the services touch, built on the packing
// fake: it only understands the filters the services use and throws on any
// other, and an update or delete that matches nothing fails like Prisma's
// P2025. Two users, A and B, each with their own data: the services run as one
// of them with the ids of the other.

type Row = Record<string, unknown>;

export const A = "user-a";
export const B = "user-b";

const defaults = {
  user: (): Row => ({ id: nextId("user"), status: "APPROVED", isAdmin: false }),
  trip: (): Row => ({ id: nextId("trip"), userId: "", name: "", currency: "EUR" }),
  destination: (): Row => ({ id: nextId("destination"), tripId: "", arrivalDate: new Date(0), order: 0 }),
  flight: (): Row => ({ id: nextId("flight"), tripId: "" }),
  accommodation: (): Row => ({ id: nextId("accommodation"), tripId: "" }),
  activity: (): Row => ({ id: nextId("activity"), tripId: "" }),
  document: (): Row => ({ id: nextId("document"), tripId: "" }),
  expense: (): Row => ({ id: nextId("expense"), tripId: "", amount: 0, currency: "EUR" }),
  task: (): Row => ({ id: nextId("task"), tripId: "" }),
  suitcase: (): Row => ({ id: nextId("suitcase"), tripId: "" }),
  packingItem: (): Row => ({ id: nextId("item"), tripId: "", suitcaseId: null, packed: false }),
  diveLog: (): Row => ({ id: nextId("dive"), userId: "", tripId: null, date: new Date(0), diveNumber: 0, diveSiteId: null, equipment: [] }),
  diveSite: (): Row => ({ id: nextId("site"), userId: "", address: null, diveAreaId: null }),
  diveArea: (): Row => ({ id: nextId("area"), userId: "" }),
  diveEquipment: (): Row => ({ id: nextId("equipment"), userId: "", name: "", status: "OWNED" }),
  diveEquipmentService: (): Row => ({ id: nextId("service"), userId: "", equipmentId: "" }),
  diveCertification: (): Row => ({ id: nextId("certification"), userId: "" }),
  diveProfileSample: (): Row => ({ id: nextId("sample"), diveLogId: "", seconds: 0, depth: 0, temp: null, ndlMinutes: null }),
  mediaClip: (): Row => ({ id: nextId("clip"), userId: "" }),
  mediaClipLink: (): Row => ({ clipId: "", diveLogId: "", included: true }),
  agentGrant: (): Row => ({ id: nextId("grant"), userId: "", name: "" }),
  agentAuditEntry: (): Row => ({
    id: nextId("entry"),
    userId: "",
    grantId: "",
    createdAt: new Date(),
    tripId: null,
    entityType: "",
    entityId: "",
    action: "CREATED",
    changes: null,
    snapshot: null,
    restoredAt: null,
  }),
  agentSuggestion: (): Row => ({
    id: nextId("suggestion"),
    tripId: "",
    grantId: "",
    kind: "ACCOMMODATION",
    payload: null,
    status: "PENDING",
    createdAt: new Date(),
    resolvedAt: null,
    resultId: null,
  }),
};

type Tables = { [K in keyof typeof defaults]: Row[] };

const state = Object.fromEntries(Object.keys(defaults).map((key) => [key, []])) as unknown as Tables;
const keys = Object.keys(defaults) as (keyof Tables)[];

// A suggestion's `trip: { userId }` looks at its trip.
const relations: Partial<Record<keyof Tables, Parameters<typeof table>[2]>> = {
  agentSuggestion: {
    trip: (row, where) => state.trip.some((trip) => trip.id === row.tripId && matchesWhere(trip, where)),
  },
};

const models = Object.fromEntries(keys.map((key) => [key, table(state[key], defaults[key], relations[key])])) as {
  [K in keyof Tables]: ReturnType<typeof table>;
};

// The raw queries and the counts of the register, in the order they run: what
// a test needs to see that the connection is locked before counting.
export const dbCalls: string[] = [];

const countEntries = models.agentAuditEntry.count;
models.agentAuditEntry.count = async (args) => {
  dbCalls.push("count agentAuditEntry");
  return countEntries(args);
};

async function queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> {
  dbCalls.push(`${strings.join("?")} ${JSON.stringify(values)}`);
  return [];
}

const client = { ...models, $queryRaw: queryRaw };

// Interactive transactions roll back on throw, like Prisma's. The array form
// gets the writes already started, as Prisma's would get them queued.
async function transaction<T>(fn: ((tx: typeof client) => Promise<T>) | readonly Promise<unknown>[]): Promise<T | unknown[]> {
  if (Array.isArray(fn)) return Promise.all(fn);
  if (typeof fn !== "function") throw new Error("fake db: unsupported transaction");
  const snapshot = structuredClone(state);
  try {
    return await fn(client);
  } catch (error) {
    for (const key of keys) state[key].splice(0, Infinity, ...snapshot[key]);
    throw error;
  }
}

export const fakeServicePrisma = { ...client, $transaction: transaction };

export const fakeServiceDb = {
  reset(seed: Partial<Tables>) {
    dbCalls.length = 0;
    for (const key of keys) state[key].splice(0, Infinity, ...(seed[key] ?? []).map((row) => ({ ...defaults[key](), ...row })));
  },
  dump: () => structuredClone(state),
  rows: <K extends keyof Tables>(key: K) => state[key],
};

// The same shape for both users, so every case can run as A and as B.
export function seedTwoUsers() {
  const forUser = (u: string): Partial<Tables> => ({
    trip: [
      { id: `trip-${u}`, userId: u, name: `Viaje ${u}`, currency: "EUR" },
      { id: `trip-${u}-2`, userId: u, name: `Otro ${u}`, currency: "EUR" },
    ],
    destination: [{ id: `dest-${u}`, tripId: `trip-${u}` }],
    flight: [{ id: `flight-${u}`, tripId: `trip-${u}` }],
    accommodation: [{ id: `acc-${u}`, tripId: `trip-${u}` }],
    activity: [{ id: `act-${u}`, tripId: `trip-${u}` }],
    document: [{ id: `doc-${u}`, tripId: `trip-${u}` }],
    expense: [{ id: `exp-${u}`, tripId: `trip-${u}`, amount: 10, currency: "EUR" }],
    task: [{ id: `task-${u}`, tripId: `trip-${u}` }],
    suitcase: [{ id: `bag-${u}`, tripId: `trip-${u}` }],
    packingItem: [{ id: `item-${u}`, tripId: `trip-${u}`, suitcaseId: `bag-${u}`, packed: true }],
    diveLog: [
      { id: `dive-${u}`, userId: u, tripId: null },
      { id: `dive-${u}-in-trip-2`, userId: u, tripId: `trip-${u}-2` },
    ],
    diveSite: [{ id: `site-${u}`, userId: u }],
    diveArea: [{ id: `area-${u}`, userId: u }],
    diveEquipment: [{ id: `eq-${u}`, userId: u }],
    diveEquipmentService: [{ id: `svc-${u}`, userId: u, equipmentId: `eq-${u}` }],
    diveCertification: [{ id: `cert-${u}`, userId: u }],
  });
  const a = forUser(A);
  const b = forUser(B);
  fakeServiceDb.reset({
    ...(Object.fromEntries(keys.map((key) => [key, [...(a[key] ?? []), ...(b[key] ?? [])]])) as Partial<Tables>),
    user: [{ id: A }, { id: B }],
  });
}
