"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { packingItemSchema as itemSchema } from "@/lib/schemas";
import { requireTripOwner } from "@/lib/action-auth";

export async function createPackingItem(tripId: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = itemSchema.parse(Object.fromEntries(formData));
  await prisma.packingItem.create({
    data: { tripId, ...data, quantity: parseInt(data.quantity) },
  });
  revalidatePath(`/trips/${tripId}/packing`);
}

export async function togglePackingItem(tripId: string, id: string, packed: boolean) {
  await requireTripOwner(tripId);
  await prisma.packingItem.update({ where: { id, tripId }, data: { packed } });
  revalidatePath(`/trips/${tripId}/packing`);
}

export async function deletePackingItem(tripId: string, id: string) {
  await requireTripOwner(tripId);
  await prisma.packingItem.delete({ where: { id, tripId } });
  revalidatePath(`/trips/${tripId}/packing`);
}

export async function addDefaultPackingItems(tripId: string) {
  await requireTripOwner(tripId);
  const defaults = [
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
  await prisma.packingItem.createMany({
    data: defaults.map((d) => ({ tripId, ...d, quantity: 1, packed: false })),
    skipDuplicates: true,
  });
  revalidatePath(`/trips/${tripId}/packing`);
}
