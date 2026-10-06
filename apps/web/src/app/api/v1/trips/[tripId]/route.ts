import { prisma } from "@/lib/prisma";
import { findOwnedTrip, withApiToken } from "@/lib/api-token";
import { apiJson, notFound } from "@/lib/api-http";
import { TRIP_DETAIL_SELECT } from "@/lib/api-selects";

export const GET = withApiToken<{ tripId: string }>("trips:read", async (_request, { userId }, { params }) => {
  const { tripId } = await params;
  if (!(await findOwnedTrip(tripId, userId))) return notFound();

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: TRIP_DETAIL_SELECT });
  if (!trip) return notFound();
  return apiJson(200, trip);
});
