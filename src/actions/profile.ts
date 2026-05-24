"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/schemas";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  return session.user.id;
}

export async function updateProfile(formData: FormData) {
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
