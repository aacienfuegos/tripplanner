"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !session?.user?.email || session.user.email !== adminEmail) {
    redirect("/dashboard");
  }
}

export async function approveUser(formData: FormData) {
  await requireAdmin();
  const userId = formData.get("userId") as string;
  await prisma.user.update({ where: { id: userId }, data: { status: "APPROVED" } });
  revalidatePath("/admin");
}

export async function denyUser(formData: FormData) {
  await requireAdmin();
  const userId = formData.get("userId") as string;
  await prisma.user.update({ where: { id: userId }, data: { status: "DENIED" } });
  revalidatePath("/admin");
}

export async function revokeUser(formData: FormData) {
  await requireAdmin();
  const userId = formData.get("userId") as string;
  await prisma.user.update({ where: { id: userId }, data: { status: "PENDING" } });
  revalidatePath("/admin");
}

export async function setRegistrationOpen(formData: FormData) {
  await requireAdmin();
  const open = formData.get("open") === "true";
  await prisma.settings.upsert({
    where: { id: "global" },
    update: { registrationOpen: open },
    create: { id: "global", registrationOpen: open },
  });
  revalidatePath("/admin");
}
