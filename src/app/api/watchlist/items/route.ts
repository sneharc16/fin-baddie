import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_USER_ID } from "@/lib/constants";
import { apiError, parseJson } from "@/lib/validation/api";
import { services } from "@/server/container";

const schema = z.object({ instrumentId: z.string().trim().min(1) }).strict();

export async function POST(request: Request) {
  try {
    const { instrumentId } = await parseJson(request, schema);
    return NextResponse.json({ item: await services.watchlist.add(DEMO_USER_ID, instrumentId) }, { status: 201 });
  } catch (error: unknown) {
    return apiError(error);
  }
}
