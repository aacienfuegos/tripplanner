// In-memory stand-in for the Prisma models the packing actions touch, so the
// tests check what ends up stored instead of the shape of each where. It
// understands only the filters those actions use and throws on anything else,
// so a new filter can't pass a test by being ignored. `{ not: x }` follows SQL:
// it is never true for a NULL column, like `"suitcaseId" <> $1` in PostgreSQL.

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

function matchesField(value: unknown, cond: unknown): boolean {
  if (cond === null || typeof cond !== "object") return value === cond;
  const [key, ...rest] = Object.keys(cond);
  const arg = (cond as Record<string, unknown>)[key];
  if (rest.length === 0 && key === "in" && Array.isArray(arg)) return value !== null && arg.includes(value);
  if (rest.length === 0 && key === "not") return arg === null ? value !== null : value !== null && value !== arg;
  const ops = Object.entries(cond as Record<string, unknown>);
  if (!(cond instanceof Date) && ops.length > 0 && ops.every(([op]) => ["in", "gt", "lt", "gte"].includes(op))) {
    return ops.every(([op, bound]) => {
      if (op === "in" && Array.isArray(bound)) return value !== null && bound.includes(value);
      if (value === null || value === undefined) return false;
      const order = (x: unknown) => (x instanceof Date ? x.getTime() : x);
      const v = order(value);
      const b = order(bound);
      if (typeof v === "number" && typeof b === "number") return op === "gt" ? v > b : op === "lt" ? v < b : v >= b;
      if (typeof v === "string" && typeof b === "string") return op === "gt" ? v > b : op === "lt" ? v < b : v >= b;
      throw new Error(`fake db: unsupported bound ${op}`);
    });
  }
  throw new Error(`fake db: unsupported filter ${JSON.stringify(cond)}`);
}

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (cond === undefined) return true;
    if (key === "OR" && Array.isArray(cond)) return cond.some((w: Where) => matches(row, w));
    if (!(key in row)) throw new Error(`fake db: unknown field ${key}`);
    return matchesField(row[key], cond);
  });
}

// Like Prisma's error for an update or delete whose where matched nothing.
const recordNotFound = (operation: string) =>
  Object.assign(new Error(`fake db: record to ${operation} not found (P2025)`), { code: "P2025" });

let sequence = 0;
export const nextId = (prefix: string) => `${prefix}-new-${++sequence}`;

// Prisma leaves a field out of the write when its value is undefined.
const defined = (data: Row): Row => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));

export function table(rows: Row[], defaults: () => Row) {
  const build = (data: Row) => ({ ...defaults(), ...defined(data) });
  return {
    findUnique: async ({ where }: { where: Where }) => rows.find((r) => matches(r, where)) ?? null,
    findFirst: async ({ where }: { where: Where }) => rows.find((r) => matches(r, where)) ?? null,
    findMany: async ({ where, orderBy, take }: { where?: Where; orderBy?: Record<string, "asc" | "desc">; take?: number } = {}) => {
      const found = rows.filter((r) => matches(r, where));
      const [key, direction] = Object.entries(orderBy ?? {})[0] ?? [];
      const sign = direction === "desc" ? -1 : 1;
      const compare = (a: unknown, b: unknown) =>
        typeof a === "string" && typeof b === "string" ? a.localeCompare(b) : Number(a) - Number(b);
      const sorted = key ? found.sort((a, b) => compare(a[key], b[key]) * sign) : found;
      return take === undefined ? sorted : sorted.slice(0, take);
    },
    create: async ({ data }: { data: Row }) => {
      const row = build(data);
      rows.push(row);
      return row;
    },
    createMany: async ({ data }: { data: Row[] }) => {
      rows.push(...data.map(build));
      return { count: data.length };
    },
    createManyAndReturn: async ({ data }: { data: Row[] }) => {
      const created = data.map(build);
      rows.push(...created);
      return created;
    },
    update: async ({ where, data }: { where: Where; data: Row }) => {
      const i = rows.findIndex((r) => matches(r, where));
      if (i === -1) throw recordNotFound("update");
      rows[i] = { ...rows[i], ...defined(data) };
      return rows[i];
    },
    updateMany: async ({ where, data }: { where: Where; data: Row }) => {
      let count = 0;
      rows.forEach((r, i) => {
        if (matches(r, where)) {
          rows[i] = { ...r, ...defined(data) };
          count++;
        }
      });
      return { count };
    },
    delete: async ({ where }: { where: Where }) => {
      const i = rows.findIndex((r) => matches(r, where));
      if (i === -1) throw recordNotFound("delete");
      return rows.splice(i, 1)[0];
    },
    deleteMany: async ({ where }: { where: Where }) => {
      const kept = rows.filter((r) => !matches(r, where));
      const count = rows.length - kept.length;
      rows.splice(0, rows.length, ...kept);
      return { count };
    },
  };
}

const state = {
  user: [] as Row[],
  trip: [] as Row[],
  suitcase: [] as Row[],
  packingItem: [] as Row[],
  diveEquipment: [] as Row[],
};

const defaults = {
  user: (): Row => ({ id: nextId("user"), status: "APPROVED" }),
  trip: (): Row => ({ id: nextId("trip"), userId: "", currency: "EUR" }),
  suitcase: (): Row => ({
    id: nextId("suitcase"),
    tripId: "",
    name: "",
    type: "OTHER",
    weightGrams: null,
    createdAt: new Date(sequence),
  }),
  packingItem: (): Row => ({
    id: nextId("item"),
    tripId: "",
    suitcaseId: null,
    category: "",
    name: "",
    packed: false,
    quantity: 1,
  }),
  diveEquipment: (): Row => ({ id: nextId("equipment"), userId: "", name: "", status: "OWNED" }),
};

const models = {
  user: table(state.user, defaults.user),
  trip: table(state.trip, defaults.trip),
  suitcase: table(state.suitcase, defaults.suitcase),
  packingItem: table(state.packingItem, defaults.packingItem),
  diveEquipment: table(state.diveEquipment, defaults.diveEquipment),
};

type Tables = typeof state;

// Interactive transactions roll back on throw, like Prisma's.
async function transaction<T>(fn: (tx: typeof models) => Promise<T>): Promise<T> {
  const snapshot = structuredClone(state);
  try {
    return await fn(models);
  } catch (error) {
    for (const key of Object.keys(state) as (keyof Tables)[]) state[key].splice(0, Infinity, ...snapshot[key]);
    throw error;
  }
}

export const fakePrisma = { ...models, $transaction: transaction };

export const fakeDb = {
  reset(seed: Partial<Record<keyof Tables, Row[]>>) {
    for (const key of Object.keys(state) as (keyof Tables)[]) {
      state[key].splice(0, Infinity, ...(seed[key] ?? []).map((row) => ({ ...defaults[key](), ...row })));
    }
  },
  dump: () => structuredClone(state),
  suitcases: (tripId: string) => state.suitcase.filter((s) => s.tripId === tripId),
  items: (tripId: string) => state.packingItem.filter((i) => i.tripId === tripId),
  item: (id: string) => state.packingItem.find((i) => i.id === id),
};
