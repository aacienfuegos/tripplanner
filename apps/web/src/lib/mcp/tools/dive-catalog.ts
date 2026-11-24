import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  diveAreaInputSchema,
  diveCertificationInputSchema,
  diveEquipmentInputSchema,
  diveEquipmentServiceInputSchema,
  diveSiteInputSchema,
} from "@/lib/agent-schemas";
import { requireEquipment } from "@/lib/services/access";
import { duplicateOf } from "@/lib/services/agent-duplicates";
import { DuplicateError, NotFoundError, type Entity } from "@/lib/services/errors";
import { createDiveArea, createDiveSite, updateDiveArea, updateDiveSite } from "@/lib/services/dive-sites";
import { createDiveEquipment, createDiveEquipmentService, updateDiveEquipment } from "@/lib/services/dive-equipment";
import { createDiveCertification, updateDiveCertification } from "@/lib/services/dive-certifications";
import { listCertifications, listDiveAreas, listDiveSites, listEquipment } from "@/lib/services/dive-reads";
import { CREATE, DUPLICATES, EDIT, READ, defineTool, idInput, recordOutput, toOutput } from "@/lib/mcp/tool";

// Sites, areas, equipment, its service and certifications: always the
// user's, with `{ id, userId }`.

const force = { force: z.boolean().optional() };
const PARTIAL = "Changes the fields given and leaves the rest; null clears an optional field.";
const items = z.object({ items: z.array(recordOutput) });

function rejectIfDuplicate(existing: Record<string, unknown> | null) {
  if (existing) throw new DuplicateError(toOutput(existing));
}

async function found(entity: Entity, row: Promise<Record<string, unknown> | null>) {
  const value = await row;
  if (!value) throw new NotFoundError(entity);
  return toOutput(value);
}

export const diveCatalogTools = [
  defineTool({
    name: "list_dive_sites",
    scope: "dives:read",
    title: "List dive sites",
    description: "The dive sites of the logbook, each with the name of its area.",
    input: z.object({}),
    output: items,
    annotations: READ,
    run: async ({ actor }) => {
      const { sites, areaNames } = await listDiveSites(actor);
      return {
        items: sites.map((site) => ({
          ...toOutput(site),
          areaName: site.diveAreaId ? (areaNames.get(site.diveAreaId) ?? null) : null,
        })),
      };
    },
  }),
  defineTool({
    name: "list_dive_areas",
    scope: "dives:read",
    title: "List dive areas",
    description: "The areas that group the dive sites.",
    input: z.object({}),
    output: items,
    annotations: READ,
    run: async ({ actor }) => ({ items: (await listDiveAreas(actor)).map(toOutput) }),
  }),
  defineTool({
    name: "list_equipment",
    scope: "dives:read",
    title: "List diving equipment",
    description: "The diving equipment, each with its service history.",
    input: z.object({}),
    output: items,
    annotations: READ,
    run: async ({ actor }) => ({
      items: (await listEquipment(actor)).map(({ services, ...item }) => ({
        ...toOutput(item),
        services: services.map(toOutput),
      })),
    }),
  }),
  defineTool({
    name: "list_certifications",
    scope: "dives:read",
    title: "List diving certifications",
    description: "The diver's certifications.",
    input: z.object({}),
    output: items,
    annotations: READ,
    run: async ({ actor }) => ({ items: (await listCertifications(actor)).map(toOutput) }),
  }),
  defineTool({
    name: "create_dive_site",
    scope: "dives:write",
    title: "Add a dive site",
    description: `Adds a dive site; its address is put on the map afterwards. diveAreaId has to be one of the user's areas. Same site: similar name. ${DUPLICATES}`,
    input: diveSiteInputSchema.extend(force),
    output: z.object({ diveSite: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { force, ...input }) => {
      if (!force) rejectIfDuplicate(await duplicateOf.diveSite(actor, input));
      return { diveSite: toOutput(await createDiveSite(actor, input)) };
    },
  }),
  defineTool({
    name: "update_dive_site",
    scope: "dives:write",
    title: "Update a dive site",
    description: `${PARTIAL} A new address is put on the map again.`,
    input: diveSiteInputSchema.partial().extend({ id: idInput }),
    output: z.object({ diveSite: recordOutput }),
    annotations: EDIT,
    run: async ({ actor }, { id, ...input }) => {
      await updateDiveSite(actor, id, input);
      return { diveSite: await found("Dive site", prisma.diveSite.findUnique({ where: { id, userId: actor.userId } })) };
    },
  }),
  defineTool({
    name: "create_dive_area",
    scope: "dives:write",
    title: "Add a dive area",
    description: `Adds an area to group dive sites. Same area: similar name. ${DUPLICATES}`,
    input: diveAreaInputSchema.extend(force),
    output: z.object({ diveArea: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { force, ...input }) => {
      if (!force) rejectIfDuplicate(await duplicateOf.diveArea(actor, input));
      return { diveArea: toOutput(await createDiveArea(actor, input)) };
    },
  }),
  defineTool({
    name: "update_dive_area",
    scope: "dives:write",
    title: "Update a dive area",
    description: PARTIAL,
    input: diveAreaInputSchema.partial().extend({ id: idInput }),
    output: z.object({ diveArea: recordOutput }),
    annotations: EDIT,
    run: async ({ actor }, { id, ...input }) => {
      await updateDiveArea(actor, id, input);
      return { diveArea: await found("Dive area", prisma.diveArea.findUnique({ where: { id, userId: actor.userId } })) };
    },
  }),
  defineTool({
    name: "create_equipment",
    scope: "dives:write",
    title: "Add diving equipment",
    description: `Adds a piece of equipment. Dates are YYYY-MM-DD. Same equipment: similar name and same category. ${DUPLICATES}`,
    input: diveEquipmentInputSchema.extend(force),
    output: z.object({ equipment: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { force, ...input }) => {
      if (!force) rejectIfDuplicate(await duplicateOf.equipment(actor, input));
      return { equipment: toOutput(await createDiveEquipment(actor, input)) };
    },
  }),
  defineTool({
    name: "update_equipment",
    scope: "dives:write",
    title: "Update diving equipment",
    description: `${PARTIAL} Dates are YYYY-MM-DD.`,
    input: diveEquipmentInputSchema.partial().extend({ id: idInput }),
    output: z.object({ equipment: recordOutput }),
    annotations: EDIT,
    run: async ({ actor }, { id, ...input }) => {
      await updateDiveEquipment(actor, id, input);
      return {
        equipment: await found("Equipment", prisma.diveEquipment.findUnique({ where: { id, userId: actor.userId } })),
      };
    },
  }),
  defineTool({
    name: "create_equipment_service",
    scope: "dives:write",
    title: "Log a service of diving equipment",
    description: `Logs a service of one of the user's pieces of equipment. date is YYYY-MM-DD. Same service: same equipment, same day and similar description. ${DUPLICATES}`,
    input: diveEquipmentServiceInputSchema.extend(force),
    output: z.object({ service: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { force, ...input }) => {
      await requireEquipment(actor, input.equipmentId);
      if (!force) rejectIfDuplicate(await duplicateOf.equipmentService(actor, input));
      return { service: toOutput(await createDiveEquipmentService(actor, input)) };
    },
  }),
  defineTool({
    name: "create_certification",
    scope: "dives:write",
    title: "Add a diving certification",
    description: `Adds a certification. issueDate is YYYY-MM-DD. Same certification: same agency and same level. ${DUPLICATES}`,
    input: diveCertificationInputSchema.extend(force),
    output: z.object({ certification: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { force, ...input }) => {
      if (!force) rejectIfDuplicate(await duplicateOf.certification(actor, input));
      return { certification: toOutput(await createDiveCertification(actor, input)) };
    },
  }),
  defineTool({
    name: "update_certification",
    scope: "dives:write",
    title: "Update a diving certification",
    description: `${PARTIAL} issueDate is YYYY-MM-DD.`,
    input: diveCertificationInputSchema.partial().extend({ id: idInput }),
    output: z.object({ certification: recordOutput }),
    annotations: EDIT,
    run: async ({ actor }, { id, ...input }) => {
      await updateDiveCertification(actor, id, input);
      return {
        certification: await found(
          "Certification",
          prisma.diveCertification.findUnique({ where: { id, userId: actor.userId } }),
        ),
      };
    },
  }),
];
