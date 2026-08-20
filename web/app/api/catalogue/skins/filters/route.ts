import { createFilterOptionsResponse } from "@/lib/catalogue";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return createFilterOptionsResponse({
    apiBaseUrl: process.env.SKINRUSH_API_BASE_URL ?? "",
  });
}
