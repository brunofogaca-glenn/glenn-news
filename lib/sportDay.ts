import { unstable_cache } from "next/cache";

type ApiFootballFixture = {
  fixture?: { id?: number; date?: string; status?: { short?: string }; };
  league?: { id?: number; name?: string; country?: string };
  teams?: {
    home?: { id?: number; name?: string; logo?: string };
    away?: { id?: number; name?: string; logo?: string };
  };
  goals?: { home?: number | null; away?: number | null };
  events?: Array<{
    time?: { elapsed?: number; extra?: number | null };
    team?: { name?: string };
    player?: { name?: string };
    assist?: { name?: string | null };
    type?: string;
    detail?: string;
  }>;
};

type SportmonksFixture = {
  id?: number;
  name?: string;
  starting_at?: string;
  result_info?: string;
  participants?: Array<{
    id?: number;
    name?: string;
    meta?: { location?: "home" | "away" };
  }>;
  scores?: Array<{
    score?: { goals?: number | null };
    description?: string;
    participant?: string;
  }>;
  events?: Array<{
    minute?: number;
    extra_minute?: number | null;
    player_name?: string;
    related_player_name?: string | null;
    participant_id?: number;
    type_id?: number;
  }>;
  statistics?: Array<{
    type?: string;
    type_id?: number;
    location?: "home" | "away";
    data?: { value?: number | string | null };
  }>;
  xgfixture?: Array<{
    location?: "home" | "away";
    data?: { value?: number | string | null };
  }>;
};

export type SportGoal = {
  minute: string;
  player: string;
  assist?: string;
  team: string;
};

export type SportResult = {
  id: number;
  date: string;
  league: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  homeLogo?: string;
  awayLogo?: string;
  goals: SportGoal[];
  cards: Array<{ minute: string; player: string; team: string; red: boolean }>;
  facts: string[];
  source: "API-Football" | "Sportmonks";
};

export type SportUpcoming = {
  id: number;
  date: string;
  league: string;
  country?: string;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  importance: number;
  source: "API-Football" | "Sportmonks";
};

export type SportDayData = {
  results: SportResult[];
  upcoming: SportUpcoming[];
  provider: {
    apiFootball: boolean;
    sportmonks: boolean;
  };
  fetchedAt: string;
};

const STOCKHOLM_TIME_ZONE = "Europe/Stockholm";

function localDateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: STOCKHOLM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/[^0-9]/g, "")
    .replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
}

function localToday() {
  return localDateOffset(0);
}

function localYesterday() {
  return localDateOffset(-1);
}

function localTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: STOCKHOLM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function minuteLabel(event: NonNullable<ApiFootballFixture["events"]>[number]) {
  const elapsed = event.time?.elapsed;
  const extra = event.time?.extra;
  if (typeof elapsed !== "number") return "?";
  return extra ? String(elapsed) + "+" + String(extra) : String(elapsed);
}

function isGoal(event: NonNullable<ApiFootballFixture["events"]>[number]) {
  return event.type === "Goal" && Boolean(event.player?.name);
}

function isCard(event: NonNullable<ApiFootballFixture["events"]>[number]) {
  return event.type === "Card" && Boolean(event.player?.name);
}

const IMPORTANT_LEAGUES = new Map<string, number>([
  ["Champions League", 100],
  ["Europa League", 92],
  ["Conference League", 82],
  ["Premier League", 90],
  ["La Liga", 88],
  ["Serie A", 88],
  ["Bundesliga", 88],
  ["Ligue 1", 82],
  ["Allsvenskan", 96],
  ["Superettan", 78],
  ["FA Cup", 78],
  ["Copa del Rey", 76],
  ["DFB Pokal", 76],
  ["Svenska Cupen", 84],
]);

const IMPORTANT_TEAMS = [
  "if elfsborg",
  "manchester united",
  "liverpool",
  "arsenal",
  "chelsea",
  "manchester city",
  "tottenham",
  "barcelona",
  "real madrid",
  "atletico madrid",
  "roma",
  "juventus",
  "inter",
  "milan",
  "bayern",
  "borussia dortmund",
];

function fixtureImportance(fixture: ApiFootballFixture) {
  const leagueName = fixture.league?.name ?? "";
  const home = (fixture.teams?.home?.name ?? "").toLowerCase();
  const away = (fixture.teams?.away?.name ?? "").toLowerCase();
  let score = IMPORTANT_LEAGUES.get(leagueName) ?? 20;

  for (const team of IMPORTANT_TEAMS) {
    if (home.includes(team) || away.includes(team)) score += 40;
  }

  return score;
}

async function apiFootballGet(path: string, params: Record<string, string>) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;

  const url = new URL("https://v3.football.api-sports.io" + path);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: {
      "x-apisports-key": key,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("API-Football " + response.status + " " + response.statusText);
  }

  const data = (await response.json()) as { response?: ApiFootballFixture[]; errors?: unknown };
  return data.response ?? [];
}

function mapFixture(fixture: ApiFootballFixture): SportResult | null {
  const id = fixture.fixture?.id;
  const home = fixture.teams?.home?.name;
  const away = fixture.teams?.away?.name;
  if (!id || !home || !away || !fixture.fixture?.date) return null;

  const goals = (fixture.events ?? [])
    .filter(isGoal)
    .map(event => ({
      minute: minuteLabel(event),
      player: event.player?.name ?? "Okänd",
      assist: event.assist?.name ?? undefined,
      team: event.team?.name ?? "",
    }));

  const cards = (fixture.events ?? [])
    .filter(isCard)
    .map(event => ({
      minute: minuteLabel(event),
      player: event.player?.name ?? "Okänd",
      team: event.team?.name ?? "",
      red: (event.detail ?? "").toLowerCase().includes("red"),
    }));

  return {
    id,
    date: fixture.fixture.date,
    league: fixture.league?.name ?? "Fotboll",
    home,
    away,
    homeScore: fixture.goals?.home ?? null,
    awayScore: fixture.goals?.away ?? null,
    homeLogo: fixture.teams?.home?.logo,
    awayLogo: fixture.teams?.away?.logo,
    goals,
    cards,
    facts: [],
    source: "API-Football",
  };
}

function isFinished(fixture: ApiFootballFixture) {
  return ["FT", "AET", "PEN"].includes(fixture.fixture?.status?.short ?? "");
}

function isWithinLast24Hours(fixture: ApiFootballFixture) {
  const value = new Date(fixture.fixture?.date ?? "").getTime();
  return !isNaN(value) && value >= Date.now() - 24 * 60 * 60 * 1000 && value <= Date.now();
}

function isSwedenSeniorFixture(fixture: ApiFootballFixture) {
  const home = fixture.teams?.home?.name?.trim().toLowerCase();
  const away = fixture.teams?.away?.name?.trim().toLowerCase();
  return home === "sweden" || away === "sweden";
}

async function sportmonksGet(path: string) {
  const token = process.env.SPORTMONKS_TOKEN;
  if (!token) return null;

  const response = await fetch("https://api.sportmonks.com/v3/football" + path, {
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: token,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Sportmonks " + response.status + " " + response.statusText);
  }

  const payload = (await response.json()) as { data?: SportmonksFixture[] | SportmonksFixture };
  return payload.data ?? null;
}

async function findElfsborgTeamId() {
  const data = await sportmonksGet("/teams/search/Elfsborg");
  if (!Array.isArray(data)) return null;

  const team = data.find(item =>
    (item.name ?? "").toLowerCase().includes("elfsborg")
  );

  return team?.id ?? null;
}

function sportmonksName(fixture: SportmonksFixture, location: "home" | "away") {
  return fixture.participants?.find(
    participant => participant.meta?.location === location
  )?.name;
}

function sportmonksScore(fixture: SportmonksFixture, location: "home" | "away") {
  const score = fixture.scores?.find(
    item => (item.participant ?? "").toLowerCase() === location
  );

  return typeof score?.score?.goals === "number" ? score.score.goals : null;
}

function enrichFromSportmonks(
  result: SportResult,
  fixture: SportmonksFixture
) {
  const goals = (fixture.events ?? [])
    .filter(event => event.type_id === 14 && event.player_name)
    .map(event => ({
      minute:
        event.extra_minute
          ? String(event.minute ?? "?") + "+" + String(event.extra_minute)
          : String(event.minute ?? "?"),
      player: event.player_name ?? "Okänd",
      assist: event.related_player_name ?? undefined,
      team:
        fixture.participants?.find(participant => participant.id === event.participant_id)?.name ??
        "",
    }));

  const homeName = sportmonksName(fixture, "home");
  const awayName = sportmonksName(fixture, "away");
  const homeScore = sportmonksScore(fixture, "home");
  const awayScore = sportmonksScore(fixture, "away");

  const facts: string[] = [];

  if (fixture.xgfixture?.length) {
    const homeXg = fixture.xgfixture.find(item => item.location === "home")?.data?.value;
    const awayXg = fixture.xgfixture.find(item => item.location === "away")?.data?.value;
    if (homeXg !== undefined && awayXg !== undefined) {
      facts.push("xG " + homeXg + "–" + awayXg);
    }
  }

  const possession = fixture.statistics ?? [];
  const homePossession = possession.find(
    item =>
      (item.type ?? "").toLowerCase().includes("possession") &&
      item.location === "home"
  )?.data?.value;
  const awayPossession = possession.find(
    item =>
      (item.type ?? "").toLowerCase().includes("possession") &&
      item.location === "away"
  )?.data?.value;

  if (homePossession !== undefined && awayPossession !== undefined) {
    facts.push("bollinnehav " + homePossession + "%–" + awayPossession + "%");
  }

  return {
    ...result,
    home: homeName ?? result.home,
    away: awayName ?? result.away,
    homeScore: homeScore ?? result.homeScore,
    awayScore: awayScore ?? result.awayScore,
    goals: goals.length > 0 ? goals : result.goals,
    facts,
    source: "Sportmonks" as const,
  };
}

async function enrichElfsborg(
  results: SportResult[],
  startDate: string,
  endDate: string
) {
  if (!process.env.SPORTMONKS_TOKEN) return results;

  try {
    const teamId = await findElfsborgTeamId();
    if (!teamId) return results;

    const data = await sportmonksGet(
      `/fixtures/between/${startDate}/${endDate}/${teamId}?include=participants;scores;events:player_name,related_player_name,minute,extra_minute,participant_id;statistics;xgfixture`
    );

    if (!Array.isArray(data)) return results;

    return results.map(result => {
      if (!(result.home + " " + result.away).toLowerCase().includes("elfsborg")) {
        return result;
      }

      const match = data.find(fixture => {
        const home = (sportmonksName(fixture, "home") ?? "").toLowerCase();
        const away = (sportmonksName(fixture, "away") ?? "").toLowerCase();
        return (
          home === result.home.toLowerCase() &&
          away === result.away.toLowerCase()
        );
      });

      return match ? enrichFromSportmonks(result, match) : result;
    });
  } catch (error) {
    console.error("Sportmonks enrichment misslyckades:", error);
    return results;
  }
}

export async function fetchSportDay(): Promise<SportDayData> {
  if (!process.env.API_FOOTBALL_KEY) {
    return { results: [], upcoming: [], provider: { apiFootball: false, sportmonks: false }, fetchedAt: new Date().toISOString() };
  }

  try {
    const [yesterday, today] = await Promise.all([
      apiFootballGet("/fixtures", { date: localYesterday(), timezone: STOCKHOLM_TIME_ZONE }),
      apiFootballGet("/fixtures", { date: localToday(), timezone: STOCKHOLM_TIME_ZONE }),
    ]);

    const all = [...(yesterday ?? []), ...(today ?? [])];
    const recentFixtures = all.filter(fixture => isFinished(fixture) && isWithinLast24Hours(fixture));
    const todayUpcoming = (today ?? []).filter(
      fixture =>
        !isFinished(fixture) &&
        new Date(fixture.fixture?.date ?? "").getTime() > Date.now() &&
        isSwedenSeniorFixture(fixture)
    );

    const detailIds = recentFixtures
      .filter(fixture => fixture.fixture?.id)
      .sort((a, b) => fixtureImportance(b) - fixtureImportance(a))
      .slice(0, 12)
      .map(fixture => String(fixture.fixture?.id))
      .join("-");

    let detailed = recentFixtures;
    if (detailIds) {
      const response = await apiFootballGet("/fixtures", { ids: detailIds, timezone: STOCKHOLM_TIME_ZONE });
      if (response) detailed = response;
    }

    const results = detailed
      .map(mapFixture)
      .filter((item): item is SportResult => item !== null)
      .sort((a, b) => {
        const aElf = (a.home + " " + a.away).toLowerCase().includes("elfsborg");
        const bElf = (b.home + " " + b.away).toLowerCase().includes("elfsborg");
        if (aElf !== bElf) return aElf ? -1 : 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .slice(0, 8);

    const upcoming = todayUpcoming
      .map(fixture => ({
        id: fixture.fixture?.id ?? 0,
        date: fixture.fixture?.date ?? "",
        league: fixture.league?.name ?? "Fotboll",
        country: fixture.league?.country,
        home: fixture.teams?.home?.name ?? "Hemmalag",
        away: fixture.teams?.away?.name ?? "Bortalag",
        homeLogo: fixture.teams?.home?.logo,
        awayLogo: fixture.teams?.away?.logo,
        importance: fixtureImportance(fixture),
        source: "API-Football" as const,
      }))
      .sort((a, b) => b.importance - a.importance || new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 6);

    const enrichedResults = await enrichElfsborg(
      results,
      localYesterday(),
      localToday()
    );

    return {
      results: enrichedResults,
      upcoming,
      provider: { apiFootball: true, sportmonks: Boolean(process.env.SPORTMONKS_TOKEN) },
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Sportdata misslyckades:", error);
    return { results: [], upcoming: [], provider: { apiFootball: true, sportmonks: Boolean(process.env.SPORTMONKS_TOKEN) }, fetchedAt: new Date().toISOString() };
  }
}

