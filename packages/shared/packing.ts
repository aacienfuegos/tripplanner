// Packing logic shared by the web and Android apps. Android has no tests in CI,
// so everything here is covered by apps/web/src/__tests__/packing-shared.test.ts.

export const SUITCASE_TYPES = ["CABIN", "CHECKED", "BACKPACK", "OTHER"] as const;
export type SuitcaseType = (typeof SUITCASE_TYPES)[number];

export type UnitSystem = "METRIC" | "IMPERIAL";

export const DEFAULT_PACKING_ITEMS: readonly { readonly category: string; readonly name: string }[] = [
  { category: "Documentos", name: "Pasaporte / DNI" },
  { category: "Documentos", name: "Seguro de viaje" },
  { category: "Documentos", name: "Confirmaciones de reservas" },
  { category: "Electrónica", name: "Cargador de móvil" },
  { category: "Electrónica", name: "Adaptador de enchufe" },
  { category: "Electrónica", name: "Auriculares" },
  { category: "Ropa", name: "Ropa interior" },
  { category: "Ropa", name: "Calcetines" },
  { category: "Aseo", name: "Cepillo de dientes" },
  { category: "Aseo", name: "Medicamentos básicos" },
  { category: "Varios", name: "Tarjeta de crédito" },
  { category: "Varios", name: "Efectivo" },
];

// Case- and accent-insensitive key. Unlike normalize() in apps/web/src/lib/fuzzy-match.ts,
// it keeps punctuation: "Mochila (roja)" and "Mochila roja" are different bags.
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Android stores packed as 0 or 1.
type FilterablePackingItem = { readonly name: string; readonly packed: boolean | number };

export function filterPackingItems<T extends FilterablePackingItem>(
  items: readonly T[],
  { query, onlyPending }: { readonly query: string; readonly onlyPending: boolean },
): T[] {
  const folded = foldText(query);
  return items.filter(
    (item) => (!onlyPending || !item.packed) && (folded === "" || foldText(item.name).includes(folded)),
  );
}

// Matches wanted bag names against the trip's bags by foldText. `matched` maps the
// folded name to the existing id (the first one if two fold alike); `toCreate` has
// each missing name once, spelled as it first appears. Empty names are skipped.
export function resolveSuitcaseNames<TId>(
  existing: readonly { readonly id: TId; readonly name: string }[],
  wanted: readonly (string | null | undefined)[],
): { matched: Map<string, TId>; toCreate: string[] } {
  const existingByKey = new Map<string, TId>();
  for (const s of existing) {
    const key = foldText(s.name);
    if (!existingByKey.has(key)) existingByKey.set(key, s.id);
  }

  const matched = new Map<string, TId>();
  const toCreate = new Map<string, string>();
  for (const raw of wanted) {
    const name = raw?.trim() ?? "";
    const key = foldText(name);
    if (key === "") continue;
    const id = existingByKey.get(key);
    if (id !== undefined) matched.set(key, id);
    else if (!toCreate.has(key)) toCreate.set(key, name);
  }
  return { matched, toCreate: [...toCreate.values()] };
}

// ─── Weight ───────────────────────────────────────────────────────────────────
// Stored as whole grams so a bag keeps the same physical weight when the user
// switches units. The cap keeps huge numbers out of the INTEGER column.

export const LB_IN_GRAMS = 453.59237;
export const MAX_WEIGHT_GRAMS = 1_000_000;

const gramsPerUnit = (unitSystem: UnitSystem) => (unitSystem === "IMPERIAL" ? LB_IN_GRAMS : 1000);

export function parseWeightInput(
  raw: string,
  unitSystem: UnitSystem,
): { ok: true; grams: number | null } | { ok: false } {
  const value = raw.trim().replace(",", ".");
  if (value === "") return { ok: true, grams: null };
  if (!/^\d+(\.\d+)?$/.test(value)) return { ok: false };
  const grams = Math.round(Number(value) * gramsPerUnit(unitSystem));
  return grams > MAX_WEIGHT_GRAMS ? { ok: false } : { ok: true, grams };
}

export function formatWeight(grams: number, unitSystem: UnitSystem, lang: string): string {
  const value = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .format(grams / gramsPerUnit(unitSystem));
  return `${value} ${unitSystem === "IMPERIAL" ? "lb" : "kg"}`;
}

export function weightInputValue(grams: number | null, unitSystem: UnitSystem): string {
  return grams === null ? "" : (grams / gramsPerUnit(unitSystem)).toFixed(1);
}

// ─── Share ────────────────────────────────────────────────────────────────────
// Plain text with no app strings, so it reads the same in both languages.

type ShareablePackingItem = {
  readonly name: string;
  readonly category: string;
  readonly quantity: number;
  readonly packed: boolean | number;
};

export function buildSuitcaseShareText(suitcaseName: string, items: readonly ShareablePackingItem[]): string {
  const byCategory = new Map<string, ShareablePackingItem[]>();
  for (const item of items) {
    byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
  }

  const lines = [suitcaseName];
  for (const category of [...byCategory.keys()].sort((a, b) => a.localeCompare(b))) {
    lines.push(category);
    for (const item of byCategory.get(category) ?? []) {
      lines.push(`- [${item.packed ? "x" : " "}] ${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`);
    }
  }
  return lines.join("\n");
}
