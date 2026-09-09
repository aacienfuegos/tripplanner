"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { diveCertificationSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/action-auth";

function parseDiveCertificationData(data: ReturnType<typeof diveCertificationSchema.parse>) {
  return {
    agency: data.agency,
    level: data.level,
    certNumber: data.certNumber || null,
    issueDate: data.issueDate ? new Date(data.issueDate) : null,
    instructorName: data.instructorName || null,
    notes: data.notes || null,
  };
}

export async function createDiveCertification(formData: FormData) {
  const userId = await requireUser();
  const data = diveCertificationSchema.parse(Object.fromEntries(formData));

  await prisma.diveCertification.create({
    data: {
      userId,
      ...parseDiveCertificationData(data),
    },
  });

  revalidatePath("/dives");
}

export async function updateDiveCertification(id: string, formData: FormData) {
  const userId = await requireUser();
  const data = diveCertificationSchema.parse(Object.fromEntries(formData));

  await prisma.diveCertification.update({
    where: { id, userId },
    data: parseDiveCertificationData(data),
  });

  revalidatePath("/dives");
}

export async function deleteDiveCertification(id: string) {
  const userId = await requireUser();
  await prisma.diveCertification.delete({ where: { id, userId } });
  revalidatePath("/dives");
}
