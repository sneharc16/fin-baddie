import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError } from "@/lib/errors/app-error";

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("INVALID_JSON", "Request body must contain valid JSON.", 400);
  }
  return schema.parse(body);
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request did not pass validation.",
        details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
    }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } }, { status: 500 });
}
