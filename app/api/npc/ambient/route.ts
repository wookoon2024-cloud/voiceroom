import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "NPC ambient feature disabled" }, { status: 410 });
}
