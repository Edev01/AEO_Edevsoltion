import { NextResponse } from "next/server";
import {
  listSeroqCaptures,
  readLatestSeroqCapture,
} from "@/lib/server/seroq-captures";

export const dynamic = "force-dynamic";

export async function GET() {
  const files = await listSeroqCaptures();
  const latest = await readLatestSeroqCapture();

  return NextResponse.json({
    ok: true,
    count: files.length,
    files,
    latest,
  });
}
