import https from "https";
import http from "http";

export type InspectedSite = {
  brand: string;
  inputUrl: string;
  resolvedUrl: string;
  live: boolean;
  httpStatus: number;
  title: string;
  description: string;
  h1: string[];
  wordCount: number;
  schemaCount: number;
  schemaTypes: string[];
  error?: string;
};

export function fetchWithRedirects(urlStr: string, maxRedirects = 5): Promise<{ ok: boolean; status: number; finalUrl: string; html: string; error?: string }> {
  return new Promise((resolve) => {
    if (maxRedirects <= 0) return resolve({ ok: false, status: 0, finalUrl: urlStr, html: "", error: "Too many redirects" });
    try {
      const parsed = new URL(urlStr);
      const client = parsed.protocol === "https:" ? https : http;
      const req = client.get(urlStr, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SeroqAuditEngine/2.4", Accept: "text/html,*/*" },
        timeout: 10000
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, urlStr).toString();
          return resolve(fetchWithRedirects(next, maxRedirects - 1));
        }
        let html = "";
        res.on("data", chunk => { html += chunk; });
        res.on("end", () => resolve({ ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300, status: res.statusCode || 0, finalUrl: urlStr, html }));
      });
      req.on("error", err => resolve({ ok: false, status: 0, finalUrl: urlStr, html: "", error: err.message }));
      req.on("timeout", () => { req.destroy(); resolve({ ok: false, status: 0, finalUrl: urlStr, html: "", error: "Timeout" }); });
    } catch (e: any) {
      resolve({ ok: false, status: 0, finalUrl: urlStr, html: "", error: e.message });
    }
  });
}

export function parsePageDetails(html: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "Missing Title";

  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                    html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  const description = descMatch ? descMatch[1].replace(/\s+/g, " ").trim() : "Missing Meta Description";

  const schemaRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const schemas: any[] = [];
  let m;
  while ((m = schemaRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) schemas.push(...parsed);
      else if (parsed["@graph"] && Array.isArray(parsed["@graph"])) schemas.push(...parsed["@graph"]);
      else schemas.push(parsed);
    } catch (e) {}
  }

  const h1Matches: string[] = [];
  const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  while ((m = h1Regex.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text) h1Matches.push(text);
  }

  const cleanText = html.replace(/<script[\s\S]*?<\/script>/gi, "")
                        .replace(/<style[\s\S]*?<\/style>/gi, "")
                        .replace(/<[^>]+>/g, " ")
                        .replace(/\s+/g, " ")
                        .trim();
  const wordCount = cleanText ? cleanText.split(" ").length : 0;
  return { title, description, h1: h1Matches, schemas, wordCount };
}

export async function crawlTargetAndPeers(targetBrand: string, targetUrl: string, competitors: Array<{ brand: string; url: string }>): Promise<InspectedSite[]> {
  const all = [{ brand: targetBrand, url: targetUrl, isTarget: true }, ...competitors.map(c => ({ ...c, isTarget: false }))];
  const results: InspectedSite[] = [];

  for (const item of all) {
    const fetched = await fetchWithRedirects(item.url);
    if (!fetched.ok) {
      results.push({
        brand: item.brand,
        inputUrl: item.url,
        resolvedUrl: fetched.finalUrl,
        live: false,
        httpStatus: fetched.status,
        title: "Unreachable",
        description: "",
        h1: [],
        wordCount: 0,
        schemaCount: 0,
        schemaTypes: [],
        error: fetched.error
      });
      continue;
    }
    const parsed = parsePageDetails(fetched.html);
    const schemaTypes = Array.from(new Set(parsed.schemas.map(s => s["@type"]).filter(Boolean)));
    results.push({
      brand: item.brand,
      inputUrl: item.url,
      resolvedUrl: fetched.finalUrl,
      live: true,
      httpStatus: fetched.status,
      title: parsed.title,
      description: parsed.description,
      h1: parsed.h1,
      wordCount: parsed.wordCount,
      schemaCount: schemaTypes.length,
      schemaTypes: schemaTypes
    });
  }
  return results;
}
