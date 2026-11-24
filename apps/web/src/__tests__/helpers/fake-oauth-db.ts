// In-memory stand-in for the models of the authorization server, so the tests
// check what ends up stored. Like fake-packing-db, it understands only the
// filters the code uses and throws on any other. Interactive transactions roll
// back on throw. Two calls racing for the same row interleave at each await,
// as two requests would; the conditional updateMany is what decides the race.

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
type Shape = { select?: Record<string, unknown>; include?: Record<string, unknown> };

const MODELS = [
  "user",
  "trip",
  "oAuthClient",
  "agentGrant",
  "agentGrantTrip",
  "oAuthAuthorizationRequest",
  "oAuthCode",
  "oAuthToken",
] as const;
type Model = (typeof MODELS)[number];

let sequence = 0;
const nextId = (prefix: string) => `${prefix}-${++sequence}`;

const defaults: Record<Model, () => Row> = {
  user: () => ({ id: nextId("user"), status: "APPROVED", isAdmin: false }),
  trip: () => ({ id: nextId("trip"), userId: "", name: "", startDate: new Date(0) }),
  oAuthClient: () => ({
    id: nextId("client"),
    clientId: "",
    kind: "MANUAL",
    name: "",
    redirectUris: [],
    ownerUserId: null,
    metadataFetchedAt: null,
    createdAt: new Date(),
    deletedAt: null,
  }),
  agentGrant: () => ({
    id: nextId("grant"),
    userId: "",
    clientId: "",
    name: "",
    allTrips: false,
    scopes: [],
    createdAt: new Date(),
    lastUsedAt: new Date(),
    revokedAt: null,
    revokedReason: null,
  }),
  agentGrantTrip: () => ({ grantId: "", tripId: "" }),
  oAuthAuthorizationRequest: () => ({ state: null, createdAt: new Date(), consumedAt: null }),
  oAuthCode: () => ({ usedAt: null }),
  oAuthToken: () => ({ usedAt: null, createdAt: new Date() }),
};

// relation -> [target model, foreign key, one or many]
const relations: Partial<Record<Model, Record<string, [Model, string, "one" | "many"]>>> = {
  agentGrant: {
    client: ["oAuthClient", "clientId", "one"],
    user: ["user", "userId", "one"],
    trips: ["agentGrantTrip", "grantId", "many"],
  },
  agentGrantTrip: { trip: ["trip", "tripId", "one"] },
  oAuthAuthorizationRequest: { client: ["oAuthClient", "clientId", "one"] },
  oAuthCode: { grant: ["agentGrant", "grantId", "one"] },
  oAuthToken: { grant: ["agentGrant", "grantId", "one"] },
};

const state = Object.fromEntries(MODELS.map((m) => [m, [] as Row[]])) as Record<Model, Row[]>;

const time = (v: unknown) => (v instanceof Date ? v.getTime() : Number(v));

function matchesField(value: unknown, cond: unknown): boolean {
  if (cond === null || typeof cond !== "object" || cond instanceof Date) {
    return cond instanceof Date ? value instanceof Date && value.getTime() === cond.getTime() : value === cond;
  }
  return Object.entries(cond).every(([op, arg]) => {
    if (op === "in" && Array.isArray(arg)) return arg.includes(value);
    if (op === "gt") return value !== null && time(value) > time(arg);
    if (op === "lt") return value !== null && time(value) < time(arg);
    if (op === "gte") return value !== null && time(value) >= time(arg);
    throw new Error(`fake oauth db: unsupported filter ${op}`);
  });
}

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (cond === undefined) return true;
    if (!(key in row)) throw new Error(`fake oauth db: unknown field ${key}`);
    return matchesField(row[key], cond);
  });
}

function shape(model: Model, row: Row, args: Shape = {}): Row {
  const spec = args.select ?? args.include;
  if (!spec) return { ...row };
  const out: Row = args.select ? {} : { ...row };
  for (const [key, value] of Object.entries(spec)) {
    if (!value) continue;
    const relation = relations[model]?.[key];
    if (!relation) {
      out[key] = row[key];
      continue;
    }
    const [target, fk, cardinality] = relation;
    const nested = value === true ? {} : (value as Shape);
    if (cardinality === "one") {
      const found = state[target].find((r) => r.id === row[fk]);
      out[key] = found ? shape(target, found, nested) : null;
    } else {
      out[key] = state[target].filter((r) => r[fk] === row.id).map((r) => shape(target, r, nested));
    }
  }
  return out;
}

function sortBy(rows: Row[], orderBy?: Record<string, "asc" | "desc">): Row[] {
  const [key, direction] = Object.entries(orderBy ?? {})[0] ?? [];
  if (!key) return rows;
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => (time(a[key]) - time(b[key])) * sign);
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function table(model: Model) {
  const rows = () => state[model];
  const build = (data: Row) => ({ ...defaults[model](), ...data });
  return {
    findUnique: async (args: { where: Where } & Shape) => {
      await tick();
      const found = rows().find((r) => matches(r, args.where));
      return found ? shape(model, found, args) : null;
    },
    findFirst: async (args: { where: Where } & Shape) => {
      await tick();
      const found = rows().find((r) => matches(r, args.where));
      return found ? shape(model, found, args) : null;
    },
    findMany: async (args: { where?: Where; orderBy?: Record<string, "asc" | "desc"> } & Shape = {}) =>
      sortBy(rows().filter((r) => matches(r, args.where)), args.orderBy).map((r) => shape(model, r, args)),
    count: async ({ where }: { where?: Where } = {}) => rows().filter((r) => matches(r, where)).length,
    create: async (args: { data: Row } & Shape) => {
      const row = build(args.data);
      rows().push(row);
      return shape(model, row, args);
    },
    createMany: async ({ data }: { data: Row[] }) => {
      rows().push(...data.map(build));
      return { count: data.length };
    },
    update: async (args: { where: Where; data: Row } & Shape) => {
      const i = rows().findIndex((r) => matches(r, args.where));
      if (i === -1) throw Object.assign(new Error("fake oauth db: record not found"), { code: "P2025" });
      rows()[i] = { ...rows()[i], ...args.data };
      return shape(model, rows()[i], args);
    },
    updateMany: async ({ where, data }: { where: Where; data: Row }) => {
      let count = 0;
      rows().forEach((r, i) => {
        if (matches(r, where)) {
          rows()[i] = { ...r, ...data };
          count++;
        }
      });
      return { count };
    },
    upsert: async (args: { where: Where; create: Row; update: Row } & Shape) => {
      const i = rows().findIndex((r) => matches(r, args.where));
      if (i === -1) {
        const row = build(args.create);
        rows().push(row);
        return shape(model, row, args);
      }
      rows()[i] = { ...rows()[i], ...args.update };
      return shape(model, rows()[i], args);
    },
    deleteMany: async ({ where }: { where?: Where } = {}) => {
      const kept = rows().filter((r) => !matches(r, where));
      const count = rows().length - kept.length;
      rows().splice(0, Infinity, ...kept);
      return { count };
    },
  };
}

const models = Object.fromEntries(MODELS.map((m) => [m, table(m)])) as { [K in Model]: ReturnType<typeof table> };

export const rawQueries: string[] = [];

async function queryRaw(strings: TemplateStringsArray): Promise<unknown[]> {
  rawQueries.push(strings.join("?"));
  return [];
}

const client = { ...models, $queryRaw: queryRaw };

async function transaction<T>(fn: (tx: typeof client) => Promise<T>): Promise<T> {
  const snapshot = structuredClone(state);
  try {
    return await fn(client);
  } catch (error) {
    for (const m of MODELS) state[m].splice(0, Infinity, ...snapshot[m]);
    throw error;
  }
}

export const fakeOAuthPrisma = { ...client, $transaction: transaction };

export const fakeOAuthDb = {
  reset(seed: Partial<Record<Model, Row[]>> = {}) {
    rawQueries.length = 0;
    for (const m of MODELS) state[m].splice(0, Infinity, ...(seed[m] ?? []).map((row) => ({ ...defaults[m](), ...row })));
  },
  rows: (model: Model) => state[model],
  dump: () => structuredClone(state),
};
