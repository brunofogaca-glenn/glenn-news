/**
 * Shared canonical URL normalizer used by ingestion deduplication and click
 * classification storage. Tracking parameters are removed, while meaningful
 * query parameters are preserved.
 */
export function normalizeArticleUrl(value?: string) {
  if (!value?.trim()) return "";

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return value.trim();
    }

    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./i, "");

    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.*|fbclid|gclid|mc_cid|mc_eid|ref|source)$/i.test(key)) {
        url.searchParams.delete(key);
      }
    }

    url.searchParams.sort();

    const hostname = url.hostname + (url.port ? ":" + url.port : "");
    const pathname = url.pathname.replace(/\/+$/, "");

    return (hostname + pathname + url.search).replace(/\/$/, "");
  } catch {
    return value.trim();
  }
}
