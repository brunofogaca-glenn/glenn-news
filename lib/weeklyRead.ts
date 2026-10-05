import { cookies } from "next/headers";

const COOKIE_NAME = "glenn-weekly-read";
const MAX_READ_LINKS = 50;

export async function getWeeklyReadLinks() {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;

  if (!raw) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((value): value is string => typeof value === "string")
      .slice(0, MAX_READ_LINKS);
  } catch {
    return [];
  }
}

export async function addWeeklyReadLink(link: string) {
  const current = await getWeeklyReadLinks();
  const next = [link, ...current.filter(item => item !== link)].slice(
    0,
    MAX_READ_LINKS
  );

  const store = await cookies();

  store.set(COOKIE_NAME, JSON.stringify(next), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
