import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { diveCertificationInputSchema, type DiveCertificationInput } from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { orNotFound, parseInput } from "@/lib/services/errors";
import { toDate } from "@/lib/services/dates";

export async function createDiveCertification(actor: Actor, input: DiveCertificationInput) {
  const data = parseInput(diveCertificationInputSchema, input);
  const created = await prisma.diveCertification.create({
    data: { ...data, userId: actor.userId, issueDate: toDate(data.issueDate) },
  });
  revalidatePath("/dives");
  return created;
}

export async function updateDiveCertification(actor: Actor, id: string, input: Partial<DiveCertificationInput>) {
  const data = parseInput(diveCertificationInputSchema.partial(), input);
  await orNotFound(
    "Certification",
    prisma.diveCertification.update({
      where: { id, userId: actor.userId },
      data: { ...data, issueDate: toDate(data.issueDate) },
    }),
  );
  revalidatePath("/dives");
}

export async function deleteDiveCertification(actor: Actor, id: string) {
  await orNotFound("Certification", prisma.diveCertification.delete({ where: { id, userId: actor.userId } }));
  revalidatePath("/dives");
}
