import {
  NextResponse,
} from "next/server";

import {
  buildWhyPacket,
} from "@/lib/server/seroq-why";

export const dynamic =
  "force-dynamic";


export async function GET() {

  const packet =
    await buildWhyPacket();


  return NextResponse.json({

    ok:
      Boolean(packet),

    packet,

  });

}
