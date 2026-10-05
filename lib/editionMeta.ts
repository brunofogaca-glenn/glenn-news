import { unstable_cache } from "next/cache";

export type EditionMeta = {
  updatedAt: string;
};

async function createEditionMeta(dateKey: string): Promise<EditionMeta> {
  return {
    updatedAt: new Date().toISOString(),
  };
}

export async function getCachedEditionMeta() {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const dateKey = today.replace(/[^0-9]/g, "");

  return unstable_cache(
    () => createEditionMeta(dateKey),
    ["glenn-news-edition-meta-v1", dateKey],
    {
      revalidate: 24 * 60 * 60,
      tags: ["glenn-news-edition-meta"],
    }
  )();
}
