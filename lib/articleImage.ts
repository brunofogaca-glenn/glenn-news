export async function getOgImage(
  url: string,
  timeoutMs = 6_000
) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(Math.max(1, Math.floor(timeoutMs))),
      headers: {
        "User-Agent":
          "Mozilla/5.0 Glenn News",
      },
      cache: "force-cache",
    });

    if (!response.ok) {
      return null;
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > 2_000_000) {
      return null;
    }

    const html = (await response.text()).slice(0, 1_500_000);
    const metaTags =
      html.match(/<meta[^>]*>/gi) ?? [];

    for (const tag of metaTags) {
      const isImageMeta =
        /(?:property|name)=[\"'](?:og:image|twitter:image)[\"']/i.test(
          tag
        );

      if (!isImageMeta) {
        continue;
      }

      const contentMatch =
        tag.match(
          /content=[\"']([^\"']+)[\"']/i
        );

      if (!contentMatch?.[1]) {
        continue;
      }

      return new URL(
        contentMatch[1],
        url
      ).toString();
    }

    return null;
  } catch {
    return null;
  }
}
