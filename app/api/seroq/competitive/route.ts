import {
  NextResponse,
} from "next/server";

import {
  buildCompetitiveDigest,
} from "@/lib/server/seroq-competitive";

export const dynamic =
  "force-dynamic";

export async function GET() {

  const digest =
    await buildCompetitiveDigest();

  return NextResponse.json({
    ok: true,
    digest,
  });
}
