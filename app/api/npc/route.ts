import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "NPC feature disabled" }, { status: 410 });
}
