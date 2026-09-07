import { NextResponse } from "next/server";
import { apiError } from "@/lib/validation/api";
import { services } from "@/server/container";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await services.demo.getState());
  } catch (error: unknown) {
    return apiError(error);
  }
}
