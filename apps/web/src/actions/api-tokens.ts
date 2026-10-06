"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ApiScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/action-auth";
import { generateApiToken } from "@/lib/api-token";

const EXPIRY_DAYS = { "30": 30, "90": 90, "365": 365, never: null } as const;

const createApiTokenSchema = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(z.enum(ApiScope)).min(1),
  expiry: z.enum(["30", "90", "365", "never"]).default("90"),
});

// Devuelve el valor en claro una sola vez: en la BD solo queda su hash.
export async function createApiToken(formData: FormData): Promise<{ token: string; id: string }> {
  const userId = await requireUser();
  const data = createApiTokenSchema.parse({
    name: formData.get("name"),
    scopes: formData.getAll("scopes"),
    expiry: formData.get("expiry") ?? undefined,
  });

  const days = EXPIRY_DAYS[data.expiry];
  const { token, tokenHash, prefix } = generateApiToken();
  const created = await prisma.apiToken.create({
    data: {
      userId,
      name: data.name,
      tokenHash,
      prefix,
      scopes: [...new Set(data.scopes)],
      expiresAt: days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });

  revalidatePath("/profile");
  return { token, id: created.id };
}

export async function revokeApiToken(id: string): Promise<void> {
  const userId = await requireUser();
  await prisma.apiToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/profile");
}
