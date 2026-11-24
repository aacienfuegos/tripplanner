"use server";

import { diveEquipmentSchema, diveEquipmentServiceSchema } from "@/lib/schemas";
import type { DiveEquipmentInput } from "@/lib/agent-schemas";
import { webActor } from "@/lib/services/actor";
import * as diveEquipment from "@/lib/services/dive-equipment";

function toInput(formData: FormData): DiveEquipmentInput {
  const data = diveEquipmentSchema.parse(Object.fromEntries(formData));
  return {
    name: data.name,
    category: data.category,
    status: data.status,
    brand: data.brand || null,
    model: data.model || null,
    size: data.size || null,
    serialNumber: data.serialNumber || null,
    purchaseDate: data.purchaseDate || null,
    purchasePrice: data.purchasePrice ? Number(data.purchasePrice) : null,
    lastServiceDate: data.lastServiceDate || null,
    serviceIntervalMonths: data.serviceIntervalMonths ? Number(data.serviceIntervalMonths) : null,
    notes: data.notes || null,
  };
}

export async function createDiveEquipment(formData: FormData) {
  const actor = await webActor();
  await diveEquipment.createDiveEquipment(actor, toInput(formData));
}

export async function updateDiveEquipment(id: string, formData: FormData) {
  const actor = await webActor();
  await diveEquipment.updateDiveEquipment(actor, id, toInput(formData));
}

export async function deleteDiveEquipment(id: string) {
  const actor = await webActor();
  await diveEquipment.deleteDiveEquipment(actor, id);
}

export async function createDiveEquipmentService(formData: FormData) {
  const actor = await webActor();
  const data = diveEquipmentServiceSchema.parse(Object.fromEntries(formData));
  await diveEquipment.createDiveEquipmentService(actor, {
    equipmentId: data.equipmentId,
    date: data.date,
    description: data.description,
    cost: data.cost ? Number(data.cost) : null,
    notes: data.notes || null,
  });
}

export async function deleteDiveEquipmentService(id: string) {
  const actor = await webActor();
  await diveEquipment.deleteDiveEquipmentService(actor, id);
}
