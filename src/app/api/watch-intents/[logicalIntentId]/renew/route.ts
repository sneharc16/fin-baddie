import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/constants";
import { renewIntentSchema } from "@/lib/validation/intent-lifecycle";
import { apiError, parseJson } from "@/lib/validation/api";
import { services } from "@/server/container";

export async function POST(request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  try {
    const { logicalIntentId } = await context.params;
    const input = await parseJson(request, renewIntentSchema);
    return NextResponse.json(await services.intentLifecycle.renew(DEMO_USER_ID, logicalIntentId, input), { status: 201 });
  } catch (error: unknown) {
    return apiError(error);
  }
}
