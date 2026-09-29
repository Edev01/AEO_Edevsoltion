import {
  NextResponse,
} from "next/server";

import {
  getProofSnapshot,
  refreshProofSnapshot,
} from "@/lib/server/seroq-proof-verifier";


export const dynamic =
  "force-dynamic";


export async function GET() {

  const snapshot =
    await getProofSnapshot(
      false,
    );


  return NextResponse.json({
    ok: true,
    cached: true,
    snapshot,
  });

}


export async function POST() {

  const snapshot =
    await refreshProofSnapshot();


  return NextResponse.json({
    ok: true,
    cached: false,
    snapshot,
  });

}
