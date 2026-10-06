import { prisma } from "@/lib/prisma";
import { withApiToken } from "@/lib/api-token";
import { apiJson } from "@/lib/api-http";
import { TRIP_LIST_SELECT } from "@/lib/api-selects";

export const GET = withApiToken("trips:read", async (_request, { userId }) => {
  const trips = await prisma.trip.findMany({
    where: { userId },
    select: TRIP_LIST_SELECT,
    orderBy: { startDate: "desc" },
  });
  return apiJson(200, trips);
});
