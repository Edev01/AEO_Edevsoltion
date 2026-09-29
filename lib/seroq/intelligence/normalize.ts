import type {
  SourceCategory,
} from "./types";


const REVIEW_AGGREGATORS =
  new Set([
    "g2.com",
    "capterra.com",
    "trustradius.com",
    "softwareadvice.com",
    "getapp.com",
    "gartner.com",
    "forrester.com",
    "trustpilot.com",
    "sourceforge.net",
    "financesonline.com",
  ]);


const COMMUNITY_SOCIAL =
  new Set([
    "reddit.com",
    "youtube.com",
    "quora.com",
    "linkedin.com",
    "x.com",
    "twitter.com",
    "facebook.com",
    "tiktok.com",
    "medium.com",
    "substack.com",
    "stackoverflow.com",
    "stackexchange.com",
    "github.com",
    "producthunt.com",
  ]);


const REFERENCE =
  new Set([
    "wikipedia.org",
    "wikimedia.org",
    "wikidata.org",
    "britannica.com",
  ]);


const EDITORIAL_NEWS =
  new Set([
    "forbes.com",
    "techradar.com",
    "pcmag.com",
    "cnet.com",
    "theverge.com",
    "wired.com",
    "businessinsider.com",
    "techcrunch.com",
    "zdnet.com",
    "nytimes.com",
    "wsj.com",
    "mashable.com",
    "engadget.com",
    "tomsguide.com",
    "zapier.com",
    "hubspot.com",
    "makeuseof.com",
  ]);


export function normalizeDomain(
  value:
    | string
    | undefined
    | null,
): string {

  const raw =
    String(
      value ??
      "",
    )
      .trim()
      .toLowerCase();


  if (
    !raw
  ) {

    return "";

  }


  try {

    const candidate =
      raw.includes(
        "://",
      )
        ? raw
        : `https://${raw}`;


    const hostname =
      new URL(
        candidate,
      )
        .hostname
        .toLowerCase()
        .replace(
          /^www\./,
          "",
        )
        .replace(
          /\.$/,
          "",
        );


    return hostname;

  }
  catch {

    return raw
      .replace(
        /^[a-z]+:\/\//,
        "",
      )
      .split(
        "/",
      )[0]
      ?.split(
        "?",
      )[0]
      ?.split(
        "#",
      )[0]
      ?.replace(
        /^www\./,
        "",
      )
      .replace(
        /:\d+$/,
        "",
      )
      .replace(
        /\.$/,
        "",
      ) ??
      "";

  }

}


export function domainMatches(
  candidate:
    | string
    | undefined
    | null,

  expected:
    | string
    | undefined
    | null,
): boolean {

  const a =
    normalizeDomain(
      candidate,
    );


  const b =
    normalizeDomain(
      expected,
    );


  if (
    !a ||
    !b
  ) {

    return false;

  }


  return (
    a === b ||
    a.endsWith(
      `.${b}`,
    )
  );

}


export function classifySource(
  domain: string,

  targetDomain?: string,

  competitorDomains:
    string[] = [],
): SourceCategory {

  const normalized =
    normalizeDomain(
      domain,
    );


  if (
    targetDomain &&
    domainMatches(
      normalized,
      targetDomain,
    )
  ) {

    return "owned";

  }


  if (
    competitorDomains.some(
      (
        competitorDomain,
      ) =>
        domainMatches(
          normalized,
          competitorDomain,
        ),
    )
  ) {

    return "competitor_owned";

  }


  if (
    REVIEW_AGGREGATORS.has(
      normalized,
    )
  ) {

    return "review_aggregator";

  }


  if (
    COMMUNITY_SOCIAL.has(
      normalized,
    )
  ) {

    return "community_social";

  }


  if (
    REFERENCE.has(
      normalized,
    )
  ) {

    return "reference";

  }


  if (
    EDITORIAL_NEWS.has(
      normalized,
    )
  ) {

    return "editorial_news";

  }


  return "other";

}


export function normalizeUrl(
  value:
    | string
    | undefined
    | null,
): string {

  const raw =
    String(
      value ??
      "",
    )
      .trim();


  if (
    !raw
  ) {

    return "";

  }


  try {

    const url =
      new URL(
        raw,
      );


    const trackingKeys =
      [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "gclid",
        "fbclid",
      ];


    for (
      const key of
        trackingKeys
    ) {

      url.searchParams.delete(
        key,
      );

    }


    url.hash =
      "";


    return url.toString();

  }
  catch {

    return raw;

  }

}
