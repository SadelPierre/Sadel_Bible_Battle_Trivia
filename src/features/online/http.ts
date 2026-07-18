import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { RoomError } from "./server";

export function errorResponse(err: unknown) {
  if (err instanceof RoomError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: err.issues[0]?.message ?? "Invalid request", code: "invalid_body" },
      { status: 400 },
    );
  }
  console.error("API error:", err);
  return NextResponse.json({ error: "Something went wrong.", code: "internal" }, { status: 500 });
}
