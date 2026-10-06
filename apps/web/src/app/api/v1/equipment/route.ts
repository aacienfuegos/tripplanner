import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withApiToken } from "@/lib/api-token";
import { apiJson, readValidatedBody } from "@/lib/api-http";
import { equipmentCreateApiSchema, withDates } from "@/lib/api-schemas";
import { EQUIPMENT_SELECT } from "@/lib/api-selects";

export const POST = withApiToken("equipment:write", async (request, { userId, audit }) => {
  const body = await readValidatedBody(request, equipmentCreateApiSchema);
  if (!body.ok) return body.response;

  const equipment = await prisma.diveEquipment.create({
    data: { ...withDates(body.data, ["purchaseDate", "lastServiceDate"]), userId },
    select: EQUIPMENT_SELECT,
  });
  audit.fields = Object.keys(body.data);
  audit.resourceId = equipment.id;

  revalidatePath("/dives");
  return apiJson(201, equipment);
});
