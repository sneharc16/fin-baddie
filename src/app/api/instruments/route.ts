import { NextResponse } from "next/server";
import { services } from "@/server/container";
import { apiError } from "@/lib/validation/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ instruments: await services.instruments.listAvailable() });
  } catch (error: unknown) {
    return apiError(error);
  }
}
