import { get, put } from "@vercel/blob";

const TIME_ZONE = "Europe/Stockholm";
const API_BASE = "https://v3.football.api-sports.io";
const FOOTBALL_PREFIX = "glenn-news/football-tables/";
const FOOTBALL_SNAPSHOT_NAME = "current.json";

type ApiWrapper<T> = {
  errors?: unknown;
  response?: T;
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
  category:
    | "Sverige"
    | "England"
    | "Spanien"
    | "Italien"
    | "Europa"
    | "Landslag";
  leagueId: number;
  season: number;
  groups: FootballGroup[];
  scorers: FootballTopScorer[];
  error?: string;
};

export type FootballTablesData = {
  competitions: FootballCompetition[];
  fetchedAt: string;
};

export type FootballTablesSnapshot = FootballTablesData & {
  dateKey: string;
};

type CompetitionConfig = {
  key: string;
  title: string;
  category: FootballCompetition["category"];
  leagueId: number;
  season: number;
};

const COMPETITIONS: CompetitionConfig[] = [
  {
    key: "allsvenskan",
    title: "Allsvenskan",
    category: "Sverige",
    leagueId: 113,
    season: 2026,
  },
  {
    key: "svenska-cupen",
    title: "Svenska Cupen",
    category: "Sverige",
    leagueId: 115,
    season: 2026,
  },
  {
    key: "premier-league",
    title: "Premier League",
    category: "England",
    leagueId: 39,
    season: 2026,
  },
  {
    key: "la-liga",
    title: "La Liga",
    category: "Spanien",
    leagueId: 140,
    season: 2026,
  },
  {
    key: "serie-a",
    title: "Serie A",
    category: "Italien",
    leagueId: 135,
    season: 2026,
  },
  {
    key: "champions-league",
    title: "UEFA Champions League",
    category: "Europa",
    leagueId: 2,
    season: 2026,
  },
  {
    key: "europa-league",
    title: "UEFA Europa League",
    category: "Europa",
    leagueId: 3,
    season: 2026,
  },
  {
    key: "nations-league",
    title: "UEFA Nations League",
    category: "Europa",
    leagueId: 5,
    season: 2026,
  },
  {
    key: "em",
    title: "EM",
    category: "Landslag",
    leagueId: 4,
    season: 2028,
  },
  {
    key: "em-kval-europa",
    title: "EM-kval Europa",
    category: "Landslag",
    leagueId: 960,
    season: 2028,
  },
  {
    key: "vm",
    title: "VM",
    category: "Landslag",
    leagueId: 1,
    season: 2026,
  },
  {
    key: "vm-kval-europa",
    title: "VM-kval Europa",
    category: "Landslag",
    leagueId: 32,
    season: 2024,
  },
];

const FOOTBALL_CHUNKS: CompetitionConfig[][] = [
  COMPETITIONS.slice(0, 4),
  COMPETITIONS.slice(4, 8),
  COMPETITIONS.slice(8, 12),
];

export const FOOTBALL_CHUNK_COUNT = FOOTBALL_CHUNKS.length;

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
  if (!key) {
    throw new Error("API_FOOTBALL_KEY saknas.");
  }

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
    const details = Object.entries(payload.errors as Record<string, unknown>)
      .map(([name, value]) => name + ": " + String(value))
      .join("; ");

    throw new Error("API-Football: " + (details || "okänt API-fel"));
  }

  return payload.response ?? null;
}

function normalizeRows(groups: StandingRow[][] | undefined): FootballGroup[] {
  if (!groups?.length) return [];

  return groups
    .map((rows, index) => {
      const name =
        rows.find(row => row.group)?.group ??
        (groups.length > 1
          ? "Grupp " + String.fromCharCode(65 + index)
          : "Tabell");

      return {
        name,
        rows: rows
          .filter(row => Boolean(row.team?.name))
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
  const scorers: FootballTopScorer[] = [];

  for (const item of response ?? []) {
    const stats = item.statistics?.find(
      statistic =>
        typeof statistic.goals?.total === "number" &&
        Boolean(statistic.team?.name)
    );

    if (!item.player?.name || !stats?.team?.name) continue;

    scorers.push({
      name: item.player.name,
      team: stats.team.name,
      goals: stats.goals?.total ?? 0,
      photo: item.player.photo,
    });
  }

  return scorers.slice(0, 3);
}

async function fetchCompetition(
  config: CompetitionConfig
): Promise<FootballCompetition> {
  try {
    const [standings, topScorers] = await Promise.all([
      apiFootballGet<StandingResponse[]>(
        "/standings",
        {
          league: String(config.leagueId),
          season: String(config.season),
        }
      ),
      apiFootballGet<TopScorerResponse[]>(
        "/players/topscorers",
        {
          league: String(config.leagueId),
          season: String(config.season),
        }
      ),
    ]);

    const groups = normalizeRows(standings?.[0]?.league?.standings);
    const scorers = mapTopScorers(topScorers);

    return {
      key: config.key,
      title: config.title,
      category: config.category,
      leagueId: config.leagueId,
      season: config.season,
      groups,
      scorers,
      error:
        groups.length === 0 && scorers.length === 0
          ? "Ingen tabell- eller skytteligadata finns för vald säsong ännu."
          : undefined,
    };
  } catch (error) {
    return {
      key: config.key,
      title: config.title,
      category: config.category,
      leagueId: config.leagueId,
      season: config.season,
      groups: [],
      scorers: [],
      error:
        error instanceof Error
          ? error.message
          : "Okänt fel från API-Football.",
    };
  }
}

function snapshotPath() {
  return FOOTBALL_PREFIX + FOOTBALL_SNAPSHOT_NAME;
}

async function readFootballSnapshot(): Promise<FootballTablesSnapshot | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  try {
    const result = await get(snapshotPath(), { access: "private" });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    const parsed = JSON.parse(
      await new Response(result.stream).text()
    ) as FootballTablesSnapshot;

    if (
      !parsed.dateKey ||
      !Array.isArray(parsed.competitions) ||
      !parsed.generatedAt
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Kunde inte läsa fotbollssnapshot:", error);
    return null;
  }
}

async function saveFootballSnapshot(snapshot: FootballTablesSnapshot) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN saknas.");
  }

  await put(snapshotPath(), JSON.stringify(snapshot), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
  });
}

function emptySnapshot(dateKey = localDateKey()): FootballTablesSnapshot {
  return {
    dateKey,
    generatedAt: new Date(0).toISOString(),
    fetchedAt: new Date(0).toISOString(),
    competitions: COMPETITIONS.map(config => ({
      key: config.key,
      title: config.title,
      category: config.category,
      leagueId: config.leagueId,
      season: config.season,
      groups: [],
      scorers: [],
      error: "Dagens tabell har ännu inte uppdaterats.",
    })),
  };
}

export async function getCachedFootballTables(): Promise<FootballTablesData> {
  const snapshot = await readFootballSnapshot();

  if (snapshot) {
    return {
      competitions: snapshot.competitions,
      fetchedAt: snapshot.fetchedAt,
    };
  }

  return {
    competitions: emptySnapshot().competitions,
    fetchedAt: new Date(0).toISOString(),
  };
}

export async function refreshFootballTablesChunk(chunkIndex: number) {
  const chunk = FOOTBALL_CHUNKS[chunkIndex];

  if (!chunk) {
    throw new Error("Ogiltigt fotbollschunk-index: " + chunkIndex);
  }

  const today = localDateKey();
  const previous = await readFootballSnapshot();
  const base =
    previous?.dateKey === today
      ? previous
      : emptySnapshot(today);

  const refreshed = await Promise.all(
    chunk.map(config => fetchCompetition(config))
  );

  const byKey = new Map(refreshed.map(item => [item.key, item]));

  const snapshot: FootballTablesSnapshot = {
    dateKey: today,
    generatedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    competitions: base.competitions.map(item => byKey.get(item.key) ?? item),
  };

  await saveFootballSnapshot(snapshot);

  return snapshot;
}
