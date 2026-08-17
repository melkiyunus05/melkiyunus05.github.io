import { NextRequest, NextResponse } from "next/server";
import { setDemoMode } from "@/lib/store";
import type { DemoMode } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_MODES: DemoMode[] = ["normal", "warning", "critical", "off"];

export async function POST(req: NextRequest) {
  let body: { mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.mode || !VALID_MODES.includes(body.mode as DemoMode)) {
    return NextResponse.json({ error: `mode harus salah satu dari: ${VALID_MODES.join(", ")}` }, { status: 400 });
  }

  const result = setDemoMode(body.mode as DemoMode);
  return NextResponse.json(result);
}
