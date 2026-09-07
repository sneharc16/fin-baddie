import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/constants";
import { apiError } from "@/lib/validation/api";
import { services } from "@/server/container";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ snapshots: await services.market.currentForWatchlist(DEMO_USER_ID) });
  } catch (error: unknown) {
    return apiError(error);
  }
}
