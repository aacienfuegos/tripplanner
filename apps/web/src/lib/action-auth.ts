import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Server Actions only decode the JWT (up to 30 days old) unless they revalidate
// status themselves — a user marked DENIED after login would otherwise keep
// write access until their token expires. cache() dedupes the DB lookup across
// helpers called multiple times within the same request.
export const requireUser = cache(async function requireUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true },
  });
  if (!user || user.status === "DENIED") redirect("/auth/error?error=AccessDenied");

  return session.user.id;
});

export async function requireTripOwner(tripId: string) {
  const userId = await requireUser();
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { userId: true, currency: true },
  });
  if (!trip || trip.userId !== userId) redirect("/trips");
  return trip;
}
