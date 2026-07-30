"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { diveEquipmentSchema } from "@/lib/schemas";
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
