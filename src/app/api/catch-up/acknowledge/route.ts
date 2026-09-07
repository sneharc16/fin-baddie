import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/constants";
import { acknowledgeSchema } from "@/lib/validation/catch-up";
import { apiError, parseJson } from "@/lib/validation/api";
import { services } from "@/server/container";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, acknowledgeSchema);
    return NextResponse.json(await services.catchUp.acknowledge(DEMO_USER_ID, input));
  } catch (error: unknown) {
    return apiError(error);
  }
}
