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
      html.match(/<meta\\b[^>]*>/gi) ?? [];

    for (const tag of metaTags) {
      const propertyMatch =
        tag.match(
          /(?:property|name)=[\"']([^\"']+)[\"']/i
        );

      if (
        !propertyMatch ||
        !/^(og:image|twitter:image)$/i.test(
          propertyMatch[1]
        )
      ) {
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
