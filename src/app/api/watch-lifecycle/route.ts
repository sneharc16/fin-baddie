import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/constants";
import { AppError } from "@/lib/errors/app-error";
import { apiError } from "@/lib/validation/api";
import { services } from "@/server/container";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const instrumentId = new URL(request.url).searchParams.get("instrumentId");
    if (!instrumentId) throw new AppError("INSTRUMENT_ID_REQUIRED", "instrumentId is required.", 400);
    return NextResponse.json(await services.intentLifecycle.getInstrument(DEMO_USER_ID, instrumentId));
  } catch (error: unknown) {
    return apiError(error);
  }
}
