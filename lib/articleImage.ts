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

    const html =
      await response.text();

    const match =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
      );

    return match?.[1] ?? null;
  } catch {
    return null;
  }
}