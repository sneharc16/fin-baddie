import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/validation/api";
import { services } from "@/server/container";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("sinceSequence") ?? "-1";
    const sinceSequence = z.coerce.number().int().min(-1).parse(raw);
    return NextResponse.json({ events: await services.market.eventsSince(sinceSequence) });
  } catch (error: unknown) {
    return apiError(error);
  }
}
