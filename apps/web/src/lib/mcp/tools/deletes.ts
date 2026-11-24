import "server-only";
import { z } from "zod";
import type { Actor } from "@/lib/services/actor";
import { DELETE_LIMIT } from "@/lib/services/audit";
import { deleteAccommodation } from "@/lib/services/accommodations";
import { deleteActivity } from "@/lib/services/activities";
import { deleteDestination } from "@/lib/services/destinations";
import { deleteDocument } from "@/lib/services/documents";
import { deleteExpense } from "@/lib/services/expenses";
import { deleteFlight } from "@/lib/services/flights";
import { deletePackingItem } from "@/lib/services/packing";
import { deleteTask } from "@/lib/services/tasks";
import { deleteDiveArea, deleteDiveSite } from "@/lib/services/dive-sites";
import { deleteDiveEquipment, deleteDiveEquipmentService } from "@/lib/services/dive-equipment";
import { deleteDiveCertification } from "@/lib/services/dive-certifications";
import { DELETE, defineTool, idInput, type ToolDefinition } from "@/lib/mcp/tool";

// One element per call. There is no tool to delete a trip or a dive.

const LIMITS = `At most ${DELETE_LIMIT} deletions per connection in 24 hours: past that, the error limit gives retryAfterSeconds and nothing is deleted. The user can restore it from the register for 90 days.`;
const output = z.object({ deleted: z.object({ id: z.string() }) });

function tripElement(
  name: string,
  what: string,
  remove: (actor: Actor, tripId: string, id: string) => Promise<void>,
): ToolDefinition {
  return defineTool({
    name,
    scope: "trips:delete",
    title: `Delete ${what}`,
    description: `Deletes ${what} of a trip. ${LIMITS}`,
    input: z.object({ tripId: idInput, id: idInput }),
    output,
    annotations: DELETE,
    run: async ({ actor }, { tripId, id }) => {
      await remove(actor, tripId, id);
      return { deleted: { id } };
    },
  });
}

function diveRecord(
  name: string,
  what: string,
  blockedBy: string | null,
  remove: (actor: Actor, id: string) => Promise<void>,
): ToolDefinition {
  const conflict = blockedBy ? ` ${blockedBy}: the error conflict says how many are linked, and nothing is deleted.` : "";
  return defineTool({
    name,
    scope: "dives:delete",
    title: `Delete ${what}`,
    description: `Deletes ${what} of the logbook.${conflict} ${LIMITS}`,
    input: z.object({ id: idInput }),
    output,
    annotations: DELETE,
    run: async ({ actor }, { id }) => {
      await remove(actor, id);
      return { deleted: { id } };
    },
  });
}

export const sectionDeleteTools = [
  tripElement("delete_destination", "a destination", deleteDestination),
  tripElement("delete_flight", "a flight", deleteFlight),
  tripElement("delete_accommodation", "an accommodation", deleteAccommodation),
  tripElement("delete_activity", "an activity", deleteActivity),
  tripElement("delete_document", "a document", deleteDocument),
  tripElement("delete_expense", "an expense", deleteExpense),
  tripElement("delete_task", "a task", deleteTask),
  tripElement("delete_packing_item", "a packing item", deletePackingItem),
];

export const diveDeleteTools = [
  diveRecord("delete_dive_site", "a dive site", "A site with dives can't be deleted", deleteDiveSite),
  diveRecord("delete_dive_area", "a dive area", "An area with sites can't be deleted", deleteDiveArea),
  diveRecord(
    "delete_equipment",
    "a piece of diving equipment",
    "Equipment used in a dive or with service records can't be deleted",
    deleteDiveEquipment,
  ),
  diveRecord("delete_equipment_service", "a service record of a piece of equipment", null, deleteDiveEquipmentService),
  diveRecord("delete_certification", "a diving certification", null, deleteDiveCertification),
];
