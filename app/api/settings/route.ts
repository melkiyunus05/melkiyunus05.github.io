import { NextRequest, NextResponse } from "next/server";
import { snapshot, updateThresholds } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await snapshot();
  return NextResponse.json(s.thresholds);
}

export async function POST(req: NextRequest) {
  let body: { structuralStressWarningKPa?: number; pushNotificationsEnabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Partial<{ structuralStressWarningKPa: number; pushNotificationsEnabled: boolean }> = {};
  if (typeof body.structuralStressWarningKPa === "number") {
    patch.structuralStressWarningKPa = body.structuralStressWarningKPa;
  }
  if (typeof body.pushNotificationsEnabled === "boolean") {
    patch.pushNotificationsEnabled = body.pushNotificationsEnabled;
  }

  const thresholds = await updateThresholds(patch);
  return NextResponse.json(thresholds);
}
