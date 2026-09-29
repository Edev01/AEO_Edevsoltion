import { NextResponse } from "next/server";

import {
  readLatestMeasurementSummary,
} from "@/lib/server/seroq-measurement";

export const dynamic = "force-dynamic";

export async function GET() {
  const measurement =
    await readLatestMeasurementSummary();

  if (!measurement) {
    return NextResponse.json({
      ok: true,
      measurement: null,
    });
  }

  return NextResponse.json({
    ok: true,
    measurement,
  });
}
