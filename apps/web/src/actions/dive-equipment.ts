"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { diveEquipmentSchema, diveEquipmentServiceSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/action-auth";

function parseDiveEquipmentData(data: ReturnType<typeof diveEquipmentSchema.parse>) {
  return {
    name: data.name,
    category: data.category,
    status: data.status,
    brand: data.brand || null,
    model: data.model || null,
    size: data.size || null,
    serialNumber: data.serialNumber || null,
    purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
    purchasePrice: data.purchasePrice ? Number(data.purchasePrice) : null,
    lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : null,
    serviceIntervalMonths: data.serviceIntervalMonths ? Number(data.serviceIntervalMonths) : null,
    notes: data.notes || null,
  };
}

export async function createDiveEquipment(formData: FormData) {
  const userId = await requireUser();
  const data = diveEquipmentSchema.parse(Object.fromEntries(formData));

  await prisma.diveEquipment.create({
    data: {
      userId,
      ...parseDiveEquipmentData(data),
    },
  });

  revalidatePath("/dives");
}

export async function updateDiveEquipment(id: string, formData: FormData) {
  const userId = await requireUser();
  const data = diveEquipmentSchema.parse(Object.fromEntries(formData));

  await prisma.diveEquipment.update({
    where: { id, userId },
    data: parseDiveEquipmentData(data),
  });

  revalidatePath("/dives");
  revalidatePath(`/dives/equipment/${id}`);
}

export async function deleteDiveEquipment(id: string) {
  const userId = await requireUser();
  await prisma.diveEquipment.delete({ where: { id, userId } });
  revalidatePath("/dives");
}

// equipmentId llega desde un <input type="hidden"> en un formulario cliente —
// hay que verificar que la pieza de equipo pertenece al usuario antes de
// enlazar el registro de mantenimiento.
async function requireOwnedEquipment(userId: string, equipmentId: string) {
  const equipment = await prisma.diveEquipment.findUnique({ where: { id: equipmentId, userId }, select: { id: true } });
  if (!equipment) throw new Error("Equipo no encontrado");
}

export async function createDiveEquipmentService(formData: FormData) {
  const userId = await requireUser();
  const data = diveEquipmentServiceSchema.parse(Object.fromEntries(formData));
  await requireOwnedEquipment(userId, data.equipmentId);

  await prisma.diveEquipmentService.create({
    data: {
      userId,
      equipmentId: data.equipmentId,
      date: new Date(data.date),
      description: data.description,
      cost: data.cost ? Number(data.cost) : null,
      notes: data.notes || null,
    },
  });

  revalidatePath(`/dives/equipment/${data.equipmentId}`);
}

export async function deleteDiveEquipmentService(id: string) {
  const userId = await requireUser();
  const service = await prisma.diveEquipmentService.delete({ where: { id, userId } });
  revalidatePath(`/dives/equipment/${service.equipmentId}`);
}
