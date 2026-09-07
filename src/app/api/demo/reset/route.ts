import { NextResponse } from "next/server";
import { apiError } from "@/lib/validation/api";
import { services } from "@/server/container";
import { DEMO_USER_ID } from "@/lib/constants";

export async function POST() {
  try {
    return NextResponse.json(await services.demo.reset(DEMO_USER_ID));
  } catch (error: unknown) {
    return apiError(error);
  }
}
