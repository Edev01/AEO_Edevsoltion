import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  try {
    const capturesDir = path.join(process.cwd(), "seroq-captures");
    if (!fs.existsSync(capturesDir)) {
      return NextResponse.json({ ok: false, error: "Captures directory not found" }, { status: 404 });
    }

    const files = fs.readdirSync(capturesDir).filter(f => f.endsWith(".json") && !f.includes("ground-truth-site-diff"));
    if (!files.length) {
      return NextResponse.json({ ok: false, error: "No audit records found" }, { status: 404 });
    }

    // Sort by newest modified
    files.sort((a, b) => fs.statSync(path.join(capturesDir, b)).mtimeMs - fs.statSync(path.join(capturesDir, a)).mtimeMs);
    const latestAuditFile = files[0];
    const raw = fs.readFileSync(path.join(capturesDir, latestAuditFile), "utf8");
    const report = JSON.parse(raw);

    // Read site differential if present
    const diffFile = path.join(capturesDir, "ground-truth-site-diff.json");
    let siteDiff = null;
    if (fs.existsSync(diffFile)) {
      try {
        siteDiff = JSON.parse(fs.readFileSync(diffFile, "utf8"));
      } catch (e) {}
    }

    report.siteDiff = siteDiff || report.siteDiff || [];

    return NextResponse.json({ ok: true, report, sourceFile: latestAuditFile });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
