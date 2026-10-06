import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isRecordNotFound, withApiToken } from "@/lib/api-token";
import { apiJson, notFound, readValidatedBody } from "@/lib/api-http";
import { equipmentUpdateApiSchema, withDates } from "@/lib/api-schemas";
import { EQUIPMENT_SELECT } from "@/lib/api-selects";

export const PATCH = withApiToken<{ equipmentId: string }>(
  "equipment:write",
  async (request, { userId, audit }, { params }) => {
    const { equipmentId } = await params;

    const body = await readValidatedBody(request, equipmentUpdateApiSchema);
    if (!body.ok) return body.response;

    let equipment;
    try {
      equipment = await prisma.diveEquipment.update({
        where: { id: equipmentId, userId },
        data: withDates(body.data, ["purchaseDate", "lastServiceDate"]),
        select: EQUIPMENT_SELECT,
      });
    } catch (error) {
      if (isRecordNotFound(error)) return notFound();
      throw error;
    }
    audit.fields = Object.keys(body.data);
    audit.resourceId = equipment.id;

    revalidatePath("/dives");
    revalidatePath(`/dives/equipment/${equipment.id}`);
    return apiJson(200, equipment);
  },
);
