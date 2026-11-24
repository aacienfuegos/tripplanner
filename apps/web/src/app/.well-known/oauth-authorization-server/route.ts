import { connection } from "next/server";
import { authorizationServerMetadata, metadataResponse } from "@/lib/oauth/config";

export async function GET(): Promise<Response> {
  await connection();
  return metadataResponse(authorizationServerMetadata);
}
