import { NextRequest, NextResponse } from "next/server";
import { ingestTelemetry, snapshot } from "@/lib/store";
import type { TelemetryInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await snapshot());
}

export async function POST(req: NextRequest) {
  let body: Partial<TelemetryInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const required: (keyof TelemetryInput)[] = [
    "windSpeed",
    "amplitude",
    "dutyCycle",
    "structuralStress",
    "energyOutput",
    "batteryPercent",
  ];
  for (const key of required) {
    if (typeof body[key] !== "number" || Number.isNaN(body[key])) {
      return NextResponse.json({ error: `Field '${key}' harus berupa angka.` }, { status: 400 });
    }
  }

  const result = await ingestTelemetry(body as TelemetryInput);
  return NextResponse.json(result);
}
