import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/constants";
import { apiError } from "@/lib/validation/api";
import { services } from "@/server/container";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await services.watchlist.remove(DEMO_USER_ID, id));
  } catch (error: unknown) {
    return apiError(error);
  }
}
