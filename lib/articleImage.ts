export async function getOgImage(
  url: string
) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 Glenn News",
      },
      cache: "force-cache",
    });

    const html = await response.text();
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
