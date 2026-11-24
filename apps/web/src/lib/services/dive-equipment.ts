import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  diveEquipmentInputSchema,
  diveEquipmentServiceInputSchema,
  type DiveEquipmentInput,
  type DiveEquipmentServiceInput,
} from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { requireEquipment } from "@/lib/services/access";
import { orNotFound, parseInput } from "@/lib/services/errors";
import { auditedCreate, auditedUpdate } from "@/lib/services/audit";
import { toDate } from "@/lib/services/dates";

export async function createDiveEquipment(actor: Actor, input: DiveEquipmentInput) {
  const data = parseInput(diveEquipmentInputSchema, input);
  const created = await auditedCreate(actor, { entity: "Equipment" }, (db, mark) =>
    db.diveEquipment.create({
      data: {
        ...data,
        ...mark,
        userId: actor.userId,
        purchaseDate: toDate(data.purchaseDate),
        lastServiceDate: toDate(data.lastServiceDate),
      },
    }),
  );
  revalidatePath("/dives");
  return created;
}

export async function updateDiveEquipment(actor: Actor, id: string, input: Partial<DiveEquipmentInput>) {
  const data = parseInput(diveEquipmentInputSchema.partial(), input);
  await auditedUpdate(
    actor,
    { entity: "Equipment", id },
    (db) => db.diveEquipment.findUnique({ where: { id, userId: actor.userId } }),
    (db, mark) =>
      orNotFound(
        "Equipment",
        db.diveEquipment.update({
          where: { id, userId: actor.userId },
          data: {
            ...data,
            ...mark,
            purchaseDate: toDate(data.purchaseDate),
            lastServiceDate: toDate(data.lastServiceDate),
          },
        }),
      ),
  );
  revalidatePath("/dives");
  revalidatePath(`/dives/equipment/${id}`);
}

export async function deleteDiveEquipment(actor: Actor, id: string) {
  await orNotFound("Equipment", prisma.diveEquipment.delete({ where: { id, userId: actor.userId } }));
  revalidatePath("/dives");
}

// The equipment id comes from the client: it has to be the user's before the
// service record is linked to it.
export async function createDiveEquipmentService(actor: Actor, input: DiveEquipmentServiceInput) {
  const data = parseInput(diveEquipmentServiceInputSchema, input);
  await requireEquipment(actor, data.equipmentId);
  const created = await auditedCreate(actor, { entity: "Equipment service" }, (db, mark) =>
    db.diveEquipmentService.create({ data: { ...data, ...mark, userId: actor.userId, date: toDate(data.date) } }),
  );
  revalidatePath(`/dives/equipment/${data.equipmentId}`);
  return created;
}

export async function deleteDiveEquipmentService(actor: Actor, id: string) {
  const service = await orNotFound(
    "Equipment service",
    prisma.diveEquipmentService.delete({ where: { id, userId: actor.userId } }),
  );
  revalidatePath(`/dives/equipment/${service.equipmentId}`);
}
