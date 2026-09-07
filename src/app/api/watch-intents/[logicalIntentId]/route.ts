import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/constants";
import { updateWatchIntentSchema } from "@/domain/intent/schemas";
import { apiError, parseJson } from "@/lib/validation/api";
import { services } from "@/server/container";

export async function PATCH(request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  try {
    const { logicalIntentId } = await context.params;
    const input = await parseJson(request, updateWatchIntentSchema);
    return NextResponse.json({ intent: await services.watchIntents.edit(DEMO_USER_ID, logicalIntentId, input) });
  } catch (error: unknown) {
    return apiError(error);
  }
}
