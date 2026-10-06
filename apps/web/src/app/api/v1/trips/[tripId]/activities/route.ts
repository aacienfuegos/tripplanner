import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { findOwnedTrip, withApiToken } from "@/lib/api-token";
import { apiJson, notFound, readValidatedBody } from "@/lib/api-http";
import { activityCreateApiSchema, withDates } from "@/lib/api-schemas";
import { ACTIVITY_SELECT } from "@/lib/api-selects";
import { geocodeActivity } from "@/lib/geocode-items";

export const POST = withApiToken<{ tripId: string }>(
  "activities:write",
  async (request, { userId, audit }, { params }) => {
    const { tripId } = await params;
    if (!(await findOwnedTrip(tripId, userId))) return notFound();

    const body = await readValidatedBody(request, activityCreateApiSchema);
    if (!body.ok) return body.response;

    const activity = await prisma.activity.create({
      data: { ...withDates(body.data, ["scheduledAt"]), tripId },
      select: ACTIVITY_SELECT,
    });
    audit.fields = Object.keys(body.data);
    audit.resourceId = activity.id;

    void geocodeActivity(activity.id);
    revalidatePath(`/trips/${tripId}/activities`);
    return apiJson(201, activity);
  },
);
