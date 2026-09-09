"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/action-auth";

export async function updateProfile(formData: FormData) {
  const userId = await requireUser();
  const raw = Object.fromEntries(formData);
  const data = profileSchema.parse(raw);

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      image: data.image || null,
      unitSystem: data.unitSystem,
    },
  });

  revalidatePath("/profile");
}

export async function completeOnboarding(formData: FormData) {
  const userId = await requireUser();
  const raw = Object.fromEntries(formData);
  const data = profileSchema.parse(raw);

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      image: data.image || null,
    },
  });

  redirect("/dashboard");
}
