import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { findOwnedTrip, withApiToken } from "@/lib/api-token";
import { apiJson, notFound, readValidatedBody } from "@/lib/api-http";
import { accommodationCreateApiSchema, withDates } from "@/lib/api-schemas";
import { ACCOMMODATION_SELECT } from "@/lib/api-selects";
import { geocodeAccommodation } from "@/lib/geocode-items";

export const POST = withApiToken<{ tripId: string }>(
  "accommodations:write",
  async (request, { userId, audit }, { params }) => {
    const { tripId } = await params;
    if (!(await findOwnedTrip(tripId, userId))) return notFound();

    const body = await readValidatedBody(request, accommodationCreateApiSchema);
    if (!body.ok) return body.response;

    const accommodation = await prisma.accommodation.create({
      data: { ...withDates(body.data, ["checkIn", "checkOut"]), tripId },
      select: ACCOMMODATION_SELECT,
    });
    audit.fields = Object.keys(body.data);
    audit.resourceId = accommodation.id;

    void geocodeAccommodation(accommodation.id);
    revalidatePath(`/trips/${tripId}/accommodations`);
    return apiJson(201, accommodation);
  },
);
