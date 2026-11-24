import { connection } from "next/server";
import { metadataResponse, protectedResourceMetadata } from "@/lib/oauth/config";

export async function GET(): Promise<Response> {
  await connection();
  return metadataResponse(protectedResourceMetadata);
}
