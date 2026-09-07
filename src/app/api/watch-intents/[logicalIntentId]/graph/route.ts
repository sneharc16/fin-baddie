import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/constants";
import { saveWatchGraphSchema } from "@/lib/validation/watch-graph";
import { apiError, parseJson } from "@/lib/validation/api";
import { services } from "@/server/container";

export async function GET(_request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  try {
    const { logicalIntentId } = await context.params;
    return NextResponse.json(await services.watchGraphs.get(DEMO_USER_ID, logicalIntentId));
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  try {
    const { logicalIntentId } = await context.params;
    const input = await parseJson(request, saveWatchGraphSchema);
    return NextResponse.json({ graph: await services.watchGraphs.create(DEMO_USER_ID, logicalIntentId, input) }, { status: 201 });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  try {
    const { logicalIntentId } = await context.params;
    const input = await parseJson(request, saveWatchGraphSchema);
    return NextResponse.json({ graph: await services.watchGraphs.edit(DEMO_USER_ID, logicalIntentId, input) });
  } catch (error: unknown) {
    return apiError(error);
  }
}
