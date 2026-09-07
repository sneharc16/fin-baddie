import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/constants";
import { AppError } from "@/lib/errors/app-error";
import { createWatchIntentSchema } from "@/domain/intent/schemas";
import { apiError, parseJson } from "@/lib/validation/api";
import { services } from "@/server/container";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const instrumentId = new URL(request.url).searchParams.get("instrumentId");
    if (!instrumentId) throw new AppError("INSTRUMENT_ID_REQUIRED", "instrumentId is required.", 400);
    return NextResponse.json({ intents: await services.watchIntents.list(DEMO_USER_ID, instrumentId) });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { instrumentId, intent } = await parseJson(request, createWatchIntentSchema);
    return NextResponse.json({ intent: await services.watchIntents.create(DEMO_USER_ID, instrumentId, intent) }, { status: 201 });
  } catch (error: unknown) {
    return apiError(error);
  }
}
