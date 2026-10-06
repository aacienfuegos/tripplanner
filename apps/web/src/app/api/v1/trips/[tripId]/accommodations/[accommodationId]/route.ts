import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { findOwnedTrip, isRecordNotFound, withApiToken } from "@/lib/api-token";
import { apiJson, notFound, readValidatedBody } from "@/lib/api-http";
import { accommodationUpdateApiSchema, withDates } from "@/lib/api-schemas";
import { ACCOMMODATION_SELECT } from "@/lib/api-selects";
import { geocodeAccommodation } from "@/lib/geocode-items";

// La consulta de geocodificado depende de estos campos (geocode-items.ts).
const GEOCODED_FIELDS = ["name", "address", "city"] as const;

export const PATCH = withApiToken<{ tripId: string; accommodationId: string }>(
  "accommodations:write",
  async (request, { userId, audit }, { params }) => {
    const { tripId, accommodationId } = await params;
    if (!(await findOwnedTrip(tripId, userId))) return notFound();

    const body = await readValidatedBody(request, accommodationUpdateApiSchema);
    if (!body.ok) return body.response;

    const relocated = GEOCODED_FIELDS.some((field) => field in body.data);
    let accommodation;
    try {
      accommodation = await prisma.accommodation.update({
        where: { id: accommodationId, tripId },
        data: {
          ...withDates(body.data, ["checkIn", "checkOut"]),
          ...(relocated ? { latitude: null, longitude: null } : {}),
        },
        select: ACCOMMODATION_SELECT,
      });
    } catch (error) {
      if (isRecordNotFound(error)) return notFound();
      throw error;
    }
    audit.fields = Object.keys(body.data);
    audit.resourceId = accommodation.id;

    if (relocated) void geocodeAccommodation(accommodation.id);
    revalidatePath(`/trips/${tripId}/accommodations`);
    return apiJson(200, accommodation);
  },
);
