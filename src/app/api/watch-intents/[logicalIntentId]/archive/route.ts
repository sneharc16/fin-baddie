import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/constants";
import { apiError } from "@/lib/validation/api";
import { services } from "@/server/container";

export async function POST(_request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  try {
    const { logicalIntentId } = await context.params;
    return NextResponse.json({ intent: await services.watchIntents.archive(DEMO_USER_ID, logicalIntentId) });
  } catch (error: unknown) {
    return apiError(error);
  }
}
