import { callTool, type ToolContext } from "@/lib/mcp/tool";
import { TOOLS_BY_NAME } from "@/lib/mcp/tools";
import { A, B, fakeServiceDb, seedTwoUsers } from "./fake-service-db";

// Calls a tool of the catalog as an agent, over the services and the fake
// database, and the data the duplicate criteria need on the rows of both users.

export async function call(context: ToolContext, name: string, args: Record<string, unknown>) {
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) throw new Error(`no tool ${name}`);
  const result = await callTool(tool, context, args);
  return { isError: result.isError === true, out: result.structuredContent as Record<string, unknown> };
}

export function seedForTools() {
  seedTwoUsers();
  for (const u of [A, B]) {
    const set = (table: Parameters<typeof fakeServiceDb.rows>[0], id: string, fields: Record<string, unknown>) =>
      Object.assign(fakeServiceDb.rows(table).find((row) => row.id === id) ?? {}, fields);
    set("trip", `trip-${u}`, { startDate: new Date("2026-04-01T00:00:00"), endDate: new Date("2026-04-10T00:00:00") });
    set("trip", `trip-${u}-2`, { startDate: new Date("2026-07-01T00:00:00"), endDate: new Date("2026-07-10T00:00:00") });
    set("destination", `dest-${u}`, { city: "Kioto", country: "JP", arrivalDate: new Date("2026-04-01T00:00:00") });
    set("flight", `flight-${u}`, { flightNumber: "JL42", departureAt: new Date("2026-04-01T10:00:00") });
    set("accommodation", `acc-${u}`, { name: "Hotel Gion", city: "Kioto", checkIn: new Date("2026-04-01T00:00:00") });
    set("activity", `act-${u}`, { name: "Fushimi Inari", scheduledAt: new Date("2026-04-02T09:00:00") });
    set("document", `doc-${u}`, { name: "Pasaporte", type: "PASSPORT" });
    set("expense", `exp-${u}`, { description: "Ramen", date: new Date("2026-04-02T00:00:00") });
    set("task", `task-${u}`, { title: "Comprar yenes", dueDate: null });
    set("packingItem", `item-${u}`, { name: "Adaptador", category: "Electrónica" });
    set("diveLog", `dive-${u}`, { date: new Date("2026-03-01T10:00:00"), diveSiteId: null, diveSite: null, equipment: [] });
    set("diveLog", `dive-${u}-in-trip-2`, { date: new Date("2026-07-02T10:00:00"), diveSiteId: null, diveSite: null, equipment: [] });
    set("diveSite", `site-${u}`, { name: "Bajo de Dentro", diveAreaId: null });
    set("diveArea", `area-${u}`, { name: "Cabo de Palos" });
    set("diveEquipment", `eq-${u}`, { name: "Regulador", category: "REGULATOR" });
    set("diveEquipmentService", `svc-${u}`, { date: new Date("2026-01-10T00:00:00"), description: "Revisión anual" });
    set("diveCertification", `cert-${u}`, { agency: "PADI", level: "Open Water" });
  }
}
