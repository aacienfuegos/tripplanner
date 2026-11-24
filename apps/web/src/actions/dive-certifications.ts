"use server";

import { diveCertificationSchema } from "@/lib/schemas";
import type { DiveCertificationInput } from "@/lib/agent-schemas";
import { webActor } from "@/lib/services/actor";
import * as diveCertifications from "@/lib/services/dive-certifications";

function toInput(formData: FormData): DiveCertificationInput {
  const data = diveCertificationSchema.parse(Object.fromEntries(formData));
  return {
    agency: data.agency,
    level: data.level,
    certNumber: data.certNumber || null,
    issueDate: data.issueDate || null,
    instructorName: data.instructorName || null,
    notes: data.notes || null,
  };
}

export async function createDiveCertification(formData: FormData) {
  const actor = await webActor();
  await diveCertifications.createDiveCertification(actor, toInput(formData));
}

export async function updateDiveCertification(id: string, formData: FormData) {
  const actor = await webActor();
  await diveCertifications.updateDiveCertification(actor, id, toInput(formData));
}

export async function deleteDiveCertification(id: string) {
  const actor = await webActor();
  await diveCertifications.deleteDiveCertification(actor, id);
}
