import { createCatalogueResponse } from "@/lib/catalogue";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return createCatalogueResponse(request, {
    apiBaseUrl: process.env.SKINRUSH_API_BASE_URL ?? "",
  });
}
