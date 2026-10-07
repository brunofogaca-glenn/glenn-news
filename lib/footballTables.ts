import { unstable_cache } from "next/cache";

const TIME_ZONE = "Europe/Stockholm";
const API_BASE = "https://v3.football.api-sports.io";

type ApiWrapper<T> = {
  errors?: unknown;
  response?: T;
};

type LeagueSeason = {
  year?: number;
  current?: boolean;
  coverage?: {
    standings?: boolean;
    top_scorers?: boolean;
  };
};

type LeagueInfo = {
  league?: {
    id?: number;
    name?: string;
    type?: string;
  };
  country?: {
    name?: string;
  };
  seasons?: LeagueSeason[];
};

type StandingRow = {
  rank?: number;
  team?: {
    id?: number;
    name?: string;
    logo?: string;
  };
  points?: number;
  goalsDiff?: number;
  description?: string | null;
  group?: string;
  all?: {
    played?: number;
    win?: number;
    draw?: number;
    lose?: number;
    goals?: {
      for?: number;
      against?: number;
    };
  };
};

type StandingResponse = {
  league?: {
    id?: number;
    name?: string;
    season?: number;
    standings?: StandingRow[][];
  };
};

type TopScorerResponse = {
  player?: {
    id?: number;
    name?: string;
    photo?: string;
  };
  statistics?: Array<{
    team?: {
      id?: number;
      name?: string;
      logo?: string;
    };
    goals?: {
      total?: number | null;
    };
  }>;
};

export type FootballTableRow = {
  rank: number;
  teamId?: number;
  team: string;
  logo?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  description?: string | null;
};

export type FootballGroup = {
  name: string;
  rows: FootballTableRow[];
};

export type FootballTopScorer = {
  name: string;
  team: string;
  goals: number;
  photo?: string;
};

export type FootballCompetition = {
  key: string;
  title: string;
  category: "Sverige" | "England" | "Spanien" | "Italien" | "Europa" | "Landslag";
  leagueId: number | null;
  season: number | null;
  groups: FootballGroup[];
  scorers: FootballTopScorer[];
  error?: string;
};

export type FootballTablesData = {
  competitions: FootballCompetition[];
  fetchedAt: string;
};

type CompetitionConfig = {
  key: string;
  title: string;
  category: FootballCompetition["category"];
  fixedLeagueId?: number;
  searchName?: string;
  fixedSeason?: number;
};

const COMPETITIONS: CompetitionConfig[] = [
  { key: "allsvenskan", title: "Allsvenskan", category: "Sverige", fixedLeagueId: 113 },
  { key: "svenska-cupen", title: "Svenska Cupen", category: "Sverige", fixedLeagueId: 115 },
  { key: "premier-league", title: "Premier League", category: "England", fixedLeagueId: 39 },
  { key: "la-liga", title: "La Liga", category: "Spanien", fixedLeagueId: 140 },
  { key: "serie-a", title: "Serie A", category: "Italien", fixedLeagueId: 135 },
  { key: "champions-league", title: "UEFA Champions League", category: "Europa", fixedLeagueId: 2 },
  { key: "europa-league", title: "UEFA Europa League", category: "Europa", fixedLeagueId: 3 },
  { key: "nations-league", title: "UEFA Nations League", category: "Europa", fixedLeagueId: 5 },
  { key: "em", title: "EM", category: "Landslag", fixedLeagueId: 4, fixedSeason: 2028 },
  {
    key: "em-kval-europa",
    title: "EM-kval Europa",
    category: "Landslag",
    searchName: "Euro Championship - Qualification",
  },
  { key: "vm", title: "VM", category: "Landslag", fixedLeagueId: 1, fixedSeason: 2026 },
  {
    key: "vm-kval-europa",
    title: "VM-kval Europa",
    category: "Landslag",
    searchName: "World Cup - Qualification Europe",
  },
];

function localDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find(part => part.type === "year")?.value ?? "0000";
  const month = parts.find(part => part.type === "month")?.value ?? "00";
  const day = parts.find(part => part.type === "day")?.value ?? "00";
  return year + "-" + month + "-" + day;
}

async function apiFootballGet<T>(
  path: string,
  params: Record<string, string>
): Promise<T | null> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;

  const url = new URL(API_BASE + path);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "x-apisports-key": key,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      "API-Football " + response.status + " " + response.statusText
    );
  }

  const payload = (await response.json()) as ApiWrapper<T>;

  if (payload.errors && Object.keys(payload.errors as object).length > 0) {
    throw new Error("API-Football returnerade ett API-fel.");
  }

  return payload.response ?? null;
}

function chooseSeason(
  seasons: LeagueSeason[] | undefined,
  fixedSeason?: number
) {
  if (!seasons?.length) return fixedSeason ?? null;
  if (fixedSeason && seasons.some(item => item.year === fixedSeason)) {
    return fixedSeason;
  }

  const current = seasons.find(item => item.current && item.year);
  if (current?.year) return current.year;

  const nowYear = new Date().getUTCFullYear();
  const latestAvailable = seasons
    .map(item => item.year)
    .filter((year): year is number => typeof year === "number" && year <= nowYear)
    .sort((a, b) => b - a)[0];

  return latestAvailable ?? seasons[0]?.year ?? null;
}

async function resolveCompetition(config: CompetitionConfig) {
  if (config.fixedLeagueId && config.fixedSeason) {
    return {
      leagueId: config.fixedLeagueId,
      season: config.fixedSeason,
    };
  }

  if (config.fixedLeagueId) {
    const response = await apiFootballGet<LeagueInfo[]>(
      "/leagues",
      { id: String(config.fixedLeagueId) }
    );
    return {
      leagueId: config.fixedLeagueId,
      season: chooseSeason(response?.[0]?.seasons),
    };
  }

  if (!config.searchName) {
    return { leagueId: null, season: null };
  }

  const response = await apiFootballGet<LeagueInfo[]>(
    "/leagues",
    { search: config.searchName }
  );

  const exact = response?.find(
    item =>
      (item.league?.name ?? "").toLowerCase() ===
      config.searchName!.toLowerCase()
  );
  const candidate = exact ?? response?.[0];

  return {
    leagueId: candidate?.league?.id ?? null,
    season: chooseSeason(candidate?.seasons),
  };
}

function normalizeRows(groups: StandingRow[][] | undefined): FootballGroup[] {
  if (!groups?.length) return [];

  return groups
    .map((rows, index) => {
      const firstGroupName = rows.find(row => row.group)?.group;
      const name =
        firstGroupName ||
        (groups.length > 1 ? "Grupp " + String.fromCharCode(65 + index) : "Tabell");

      return {
        name,
        rows: rows
          .filter(row => row.team?.name)
          .map(row => ({
            rank: row.rank ?? 0,
            teamId: row.team?.id,
            team: row.team?.name ?? "Okänt lag",
            logo: row.team?.logo,
            played: row.all?.played ?? 0,
            wins: row.all?.win ?? 0,
            draws: row.all?.draw ?? 0,
            losses: row.all?.lose ?? 0,
            goalsFor: row.all?.goals?.for ?? 0,
            goalsAgainst: row.all?.goals?.against ?? 0,
            goalDifference: row.goalsDiff ?? 0,
            points: row.points ?? 0,
            description: row.description,
          })),
      };
    })
    .filter(group => group.rows.length > 0);
}

function mapTopScorers(
  response: TopScorerResponse[] | null | undefined
): FootballTopScorer[] {
  return (response ?? [])
    .map(item => {
      const stats = item.statistics?.find(
        statistic =>
          typeof statistic.goals?.total === "number" &&
          statistic.team?.name
      );

      if (!item.player?.name || !stats?.team?.name) return null;

      return {
        name: item.player.name,
        team: stats.team.name,
        goals: stats.goals?.total ?? 0,
        photo: item.player.photo,
      };
    })
    .filter((item): item is FootballTopScorer => item !== null)
    .slice(0, 3);
}

async function fetchCompetition(config: CompetitionConfig): Promise<FootballCompetition> {
  try {
    const resolved = await resolveCompetition(config);

    if (!resolved.leagueId || !resolved.season) {
      return {
        key: config.key,
        title: config.title,
        category: config.category,
        leagueId: resolved.leagueId,
        season: resolved.season,
        groups: [],
        scorers: [],
        error: "Tävlingen eller aktuell säsong kunde inte hittas.",
      };
    }

    const [standings, topScorers] = await Promise.all([
      apiFootballGet<StandingResponse[]>(
        "/standings",
        {
          league: String(resolved.leagueId),
          season: String(resolved.season),
        }
      ),
      apiFootballGet<TopScorerResponse[]>(
        "/players/topscorers",
        {
          league: String(resolved.leagueId),
          season: String(resolved.season),
        }
      ),
    ]);

    const groups = normalizeRows(standings?.[0]?.league?.standings);
    const scorers = mapTopScorers(topScorers);

    return {
      key: config.key,
      title: config.title,
      category: config.category,
      leagueId: resolved.leagueId,
      season: resolved.season,
      groups,
      scorers,
      error:
        groups.length === 0 && scorers.length === 0
          ? "Ingen tabell- eller skytteligadata finns för den valda säsongen."
          : undefined,
    };
  } catch (error) {
    return {
      key: config.key,
      title: config.title,
      category: config.category,
      leagueId: null,
      season: null,
      groups: [],
      scorers: [],
      error:
        error instanceof Error
          ? error.message
          : "Okänt fel från API-Football.",
    };
  }
}

async function fetchFootballTables(): Promise<FootballTablesData> {
  const competitions = await Promise.all(
    COMPETITIONS.map(config => fetchCompetition(config))
  );

  return {
    competitions,
    fetchedAt: new Date().toISOString(),
  };
}

const getCachedFootballTablesInternal = unstable_cache(
  fetchFootballTables,
  ["glenn-news-football-tables-v1"],
  {
    revalidate: 24 * 60 * 60,
    tags: ["glenn-news-football-tables"],
  }
);

export async function getCachedFootballTables() {
  return getCachedFootballTablesInternal();
}

export async function refreshFootballTables() {
  return getCachedFootballTablesInternal();
}

export function getFootballTablesDate() {
  return localDateKey();
}
