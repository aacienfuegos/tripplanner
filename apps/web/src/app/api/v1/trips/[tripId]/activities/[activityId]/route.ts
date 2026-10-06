import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { findOwnedTrip, isRecordNotFound, withApiToken } from "@/lib/api-token";
import { apiJson, notFound, readValidatedBody } from "@/lib/api-http";
import { activityUpdateApiSchema, withDates } from "@/lib/api-schemas";
import { ACTIVITY_SELECT } from "@/lib/api-selects";
import { geocodeActivity } from "@/lib/geocode-items";

// La consulta de geocodificado depende de estos campos (geocode-items.ts).
const GEOCODED_FIELDS = ["name", "location", "city"] as const;

export const PATCH = withApiToken<{ tripId: string; activityId: string }>(
  "activities:write",
  async (request, { userId, audit }, { params }) => {
    const { tripId, activityId } = await params;
    if (!(await findOwnedTrip(tripId, userId))) return notFound();

    const body = await readValidatedBody(request, activityUpdateApiSchema);
    if (!body.ok) return body.response;

    const relocated = GEOCODED_FIELDS.some((field) => field in body.data);
    let activity;
    try {
      activity = await prisma.activity.update({
        where: { id: activityId, tripId },
        data: {
          ...withDates(body.data, ["scheduledAt"]),
          ...(relocated ? { latitude: null, longitude: null } : {}),
        },
        select: ACTIVITY_SELECT,
      });
    } catch (error) {
      if (isRecordNotFound(error)) return notFound();
      throw error;
    }
    audit.fields = Object.keys(body.data);
    audit.resourceId = activity.id;

    if (relocated) void geocodeActivity(activity.id);
    revalidatePath(`/trips/${tripId}/activities`);
    return apiJson(200, activity);
  },
);
