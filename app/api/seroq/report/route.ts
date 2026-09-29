import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  try {
    const capturesDir = path.join(process.cwd(), "seroq-captures");
    if (!fs.existsSync(capturesDir)) {
      return NextResponse.json({ ok: false, error: "Captures directory not found" }, { status: 404 });
    }

    const files = fs.readdirSync(capturesDir).filter(f => f.endsWith(".json") && !f.includes("site-diff"));
    if (!files.length) {
      return NextResponse.json({ ok: false, error: "No audit records found" }, { status: 404 });
    }

    files.sort((a, b) => fs.statSync(path.join(capturesDir, b)).mtimeMs - fs.statSync(path.join(capturesDir, a)).mtimeMs);

    const raw = fs.readFileSync(path.join(capturesDir, files[0]), "utf8");
    const report = JSON.parse(raw);

    return NextResponse.json({ ok: true, report, sourceFile: files[0] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
