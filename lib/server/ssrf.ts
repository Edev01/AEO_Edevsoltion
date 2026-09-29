import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * SSRF guard for routes that fetch user-supplied URLs server-side.
 *
 * Rejects anything that isn't a public http(s) endpoint: non-http schemes,
 * IP literals in private/reserved ranges, and hostnames that resolve to them.
 * This blocks cloud metadata endpoints (169.254.169.254), localhost, and
 * RFC1918 / link-local / unique-local addresses.
 */

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

const BLOCKED_V4: RegExp[] = [
  /^0\./, // "this" network
  /^10\./, // RFC1918
  /^127\./, // loopback
  /^169\.254\./, // link-local (cloud metadata)
  /^192\.168\./, // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918 172.16/12
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./, // CGNAT 100.64/10
  /^192\.0\.0\./, // IETF protocol assignments
  /^192\.0\.2\./, // TEST-NET-1
  /^198\.51\.100\./, // TEST-NET-2
  /^203\.0\.113\./, // TEST-NET-3
  /^198\.1[89]\./, // benchmarking 198.18/15
  /^(22[4-9]|23\d)\./, // multicast 224-239
  /^(24\d|25[0-5])\./, // reserved 240-255 (incl. 255.255.255.255)
];

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return BLOCKED_V4.some((re) => re.test(ip));

  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::") return true; // loopback / unspecified
    if (low.startsWith("fe80")) return true; // link-local
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique-local
    // IPv4-mapped (::ffff:a.b.c.d) — re-check the embedded v4 address
    const mapped = low.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }

  return true; // unknown family — fail closed
}

/**
 * Validate that `raw` is a public http(s) URL and return the parsed URL.
 * Throws {@link SsrfError} for anything unsafe.
 */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError("Invalid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("Only http and https URLs are allowed.");
  }

  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  // Literal IP address — check directly, no DNS.
  if (net.isIP(host)) {
    if (isPrivateIp(host))
      throw new SsrfError("URL points to a private or reserved address.");
    return url;
  }

  // Obvious local hostnames.
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new SsrfError("URL points to a private host.");
  }

  let resolved: { address: string }[];
  try {
    resolved = await lookup(host, { all: true });
  } catch {
    throw new SsrfError("Could not resolve host.");
  }
  if (resolved.length === 0) throw new SsrfError("Could not resolve host.");
  for (const { address } of resolved) {
    if (isPrivateIp(address))
      throw new SsrfError("URL resolves to a private or reserved address.");
  }

  return url;
}
