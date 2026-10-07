import { unstable_cache } from "next/cache";
import { getCachedArticles } from "./articlesCache";

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
  leagueId?: number;
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

export type SportLeagueTableRow = {
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
};

export type SportLeagueScorer = {
  name: string;
  team: string;
  goals: number;
  photo?: string;
};

export type SportLeagueTable = {
  leagueId: number;
  title: string;
  season: number;
  relatedResult: {
    id: number;
    home: string;
    away: string;
    homeScore: number | null;
    awayScore: number | null;
  };
  rows: SportLeagueTableRow[];
  scorers: SportLeagueScorer[];
  error?: string;
};

export type SportDayData = {
  results: SportResult[];
  upcoming: SportUpcoming[];
  selectedLeague: SportLeagueTable | null;
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

const IMPORTANT_TEAM_PRIORITIES = new Map<string, number>([
  ["if elfsborg", 180],
  ["sweden", 170],
  ["england", 85],
  ["spain", 82],
  ["france", 82],
  ["italy", 84],
  ["germany", 80],
  ["croatia", 78],
  ["czech republic", 70],
  ["manchester united", 130],
  ["liverpool", 115],
  ["arsenal", 110],
  ["chelsea", 105],
  ["manchester city", 105],
  ["tottenham hotspur", 100],
  ["barcelona", 110],
  ["real madrid", 115],
  ["atletico madrid", 105],
  ["as roma", 100],
  ["roma", 100],
  ["juventus", 105],
  ["inter", 105],
  ["inter milan", 105],
  ["ac milan", 105],
  ["bayern munich", 105],
  ["borussia dortmund", 100],
]);

function normalizeTeamName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamPriority(name: string) {
  const normalized = normalizeTeamName(name);
  return IMPORTANT_TEAM_PRIORITIES.get(normalized) ?? 0;
}

function fixtureImportance(fixture: ApiFootballFixture, articleScore = 0) {
  const leagueName = fixture.league?.name ?? "";
  const home = fixture.teams?.home?.name ?? "";
  const away = fixture.teams?.away?.name ?? "";
  const leagueScore = IMPORTANT_LEAGUES.get(leagueName) ?? 20;

  return (
    leagueScore +
    Math.max(teamPriority(home), teamPriority(away)) +
    articleScore * 140
  );
}

function isPreferredTeam(name: string) {
  return teamPriority(name) > 0;
}

function isRelevantFixture(fixture: ApiFootballFixture) {
  const leagueScore = IMPORTANT_LEAGUES.get(fixture.league?.name ?? "") ?? 0;
  return (
    isPreferredTeam(fixture.teams?.home?.name ?? "") ||
    isPreferredTeam(fixture.teams?.away?.name ?? "") ||
    leagueScore >= 76
  );
}


const DAILY_TABLE_LEAGUES = new Map<number, string>([
  [113, "Allsvenskan"],
  [39, "Premier League"],
  [140, "La Liga"],
  [135, "Serie A"],
  [78, "Bundesliga"],
  [61, "Ligue 1"],
  [88, "Eredivisie"],
  [94, "Primeira Liga"],
]);

function dailyTableSeason() {
  return Number(localToday().slice(0, 4));
}

function stableDailyPickIndex(length: number) {
  const key = localToday();
  let hash = 0;

  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return length > 0 ? hash % length : 0;
}

type StandingRowForDailyTable = {
  rank?: number;
  team?: {
    id?: number;
    name?: string;
    logo?: string;
  };
  points?: number;
  goalsDiff?: number;
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

type TopScorerForDailyTable = {
  player?: {
    name?: string;
    photo?: string;
  };
  statistics?: Array<{
    team?: {
      name?: string;
    };
    goals?: {
      total?: number | null;
    };
  }>;
};

function normalizeDailyTableRows(
  groups: StandingRowForDailyTable[][] | undefined
): SportLeagueTableRow[] {
  const rows = groups?.[0] ?? [];

  return rows
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
    }));
}

function normalizeDailyScorers(
  response: TopScorerForDailyTable[] | null | undefined
): SportLeagueScorer[] {
  return (response ?? [])
    .map(item => {
      const statistic = item.statistics?.find(
        entry =>
          typeof entry.goals?.total === "number" &&
          Boolean(entry.team?.name)
      );

      if (!item.player?.name || !statistic?.team?.name) {
        return null;
      }

      return {
        name: item.player.name,
        team: statistic.team.name,
        goals: statistic.goals?.total ?? 0,
        photo: item.player.photo,
      };
    })
    .filter((item): item is SportLeagueScorer => item !== null)
    .slice(0, 3);
}

async function fetchSelectedLeagueTable(
  results: SportResult[]
): Promise<SportLeagueTable | null> {
  const candidates = Array.from(
    new Map(
      results
        .filter(result => result.leagueId && DAILY_TABLE_LEAGUES.has(result.leagueId))
        .map(result => [result.leagueId!, result])
    ).values()
  );

  if (!candidates.length) {
    return null;
  }

  const selectedResult = candidates[
    stableDailyPickIndex(candidates.length)
  ];

  if (!selectedResult.leagueId) {
    return null;
  }

  const title = DAILY_TABLE_LEAGUES.get(selectedResult.leagueId);
  if (!title) {
    return null;
  }

  const season = dailyTableSeason();

  const [standingsResult, scorersResult] = await Promise.allSettled([
    apiFootballGet<{ league?: { standings?: StandingRowForDailyTable[][] } }[]>(
      "/standings",
      {
        league: String(selectedResult.leagueId),
        season: String(season),
      }
    ),
    apiFootballGet<TopScorerForDailyTable[]>(
      "/players/topscorers",
      {
        league: String(selectedResult.leagueId),
        season: String(season),
      }
    ),
  ]);

  const rows =
    standingsResult.status === "fulfilled"
      ? normalizeDailyTableRows(
          standingsResult.value?.[0]?.league?.standings
        )
      : [];

  const scorers =
    scorersResult.status === "fulfilled"
      ? normalizeDailyScorers(scorersResult.value)
      : [];

  const errors: string[] = [];

  if (standingsResult.status === "rejected") {
    errors.push(
      standingsResult.reason instanceof Error
        ? standingsResult.reason.message
        : "Tabellen kunde inte hämtas."
    );
  }

  if (scorersResult.status === "rejected") {
    errors.push(
      scorersResult.reason instanceof Error
        ? scorersResult.reason.message
        : "Skytteligan kunde inte hämtas."
    );
  }

  if (!rows.length && !scorers.length) {
    return {
      leagueId: selectedResult.leagueId,
      title,
      season,
      relatedResult: {
        id: selectedResult.id,
        home: selectedResult.home,
        away: selectedResult.away,
        homeScore: selectedResult.homeScore,
        awayScore: selectedResult.awayScore,
      },
      rows: [],
      scorers: [],
      error:
        errors.join(" ") ||
        "Ingen tabell- eller skytteligadata kunde hämtas.",
    };
  }

  return {
    leagueId: selectedResult.leagueId,
    title,
    season,
    relatedResult: {
      id: selectedResult.id,
      home: selectedResult.home,
      away: selectedResult.away,
      homeScore: selectedResult.homeScore,
      awayScore: selectedResult.awayScore,
    },
    rows,
    scorers,
    error: errors.length ? errors.join(" ") : undefined,
  };
}


async function apiFootballGet<T = ApiFootballFixture[]>(
  path: string,
  params: Record<string, string>
): Promise<T | null> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;

  const url = new URL("https://v3.football.api-sports.io" + path);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: {
      "x-apisports-key": key,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      "API-Football " + response.status + " " + response.statusText
    );
  }

  const data = (await response.json()) as {
    response?: T;
    errors?: unknown;
  };

  return data.response ?? null;
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
    leagueId: fixture.league?.id,
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

function isPreferredFixture(fixture: ApiFootballFixture) {
  return (
    isPreferredTeam(fixture.teams?.home?.name ?? "") ||
    isPreferredTeam(fixture.teams?.away?.name ?? "")
  );
}

function isRelevantUpcomingFixture(fixture: ApiFootballFixture) {
  const home = fixture.teams?.home?.name ?? "";
  const away = fixture.teams?.away?.name ?? "";
  const leagueScore = IMPORTANT_LEAGUES.get(fixture.league?.name ?? "") ?? 0;
  const bothTeamsAreImportant =
    teamPriority(home) > 0 && teamPriority(away) > 0;

  return (
    isPreferredFixture(fixture) ||
    ["Allsvenskan", "Svenska Cupen"].includes(fixture.league?.name ?? "") ||
    (leagueScore >= 82 && bothTeamsAreImportant)
  );
}

type SportArticle = {
  title: string;
  description?: string;
  category?: string;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TEAM_ARTICLE_ALIASES: Record<string, string[]> = {
  "sweden": ["sweden", "sverige", "svenska landslaget", "herrlandslaget", "landslaget"],
  "england": ["england", "engelska landslaget"],
  "spain": ["spain", "spanien", "spanska landslaget"],
  "france": ["france", "frankrike", "franska landslaget"],
  "italy": ["italy", "italien", "italienska landslaget"],
  "germany": ["germany", "tyskland", "tyska landslaget"],
  "croatia": ["croatia", "kroatien"],
  "czech republic": ["czech republic", "czechia", "tjeckien"],
  "if elfsborg": ["if elfsborg", "elfsborg"],
  "manchester united": ["manchester united", "man united", "man utd"],
  "manchester city": ["manchester city", "man city"],
  "tottenham hotspur": ["tottenham", "spurs"],
  "atletico madrid": ["atletico madrid", "atletico"],
  "real madrid": ["real madrid"],
  "bayern munich": ["bayern munich", "bayern munchen", "bayern"],
  "borussia dortmund": ["borussia dortmund", "dortmund"],
  "as roma": ["as roma", "roma"],
  "inter": ["inter", "inter milan"],
  "ac milan": ["ac milan", "milan"],
  "juventus": ["juventus"],
  "barcelona": ["barcelona", "barca"],
  "liverpool": ["liverpool"],
  "arsenal": ["arsenal"],
  "chelsea": ["chelsea"],
};

function teamArticleAliases(teamName: string) {
  const normalized = normalizeText(teamName);
  const aliases = new Set<string>([
    normalized,
    ...(TEAM_ARTICLE_ALIASES[normalized] ?? []),
  ]);

  return [...aliases].filter(Boolean);
}

function articleMentionsFixture(
  fixture: ApiFootballFixture,
  articles: SportArticle[]
) {
  const text = normalizeText(
    articles
      .map(article => article.title + " " + (article.description ?? ""))
      .join(" ")
  );

  const home = fixture.teams?.home?.name ?? "";
  const away = fixture.teams?.away?.name ?? "";

  return Math.max(
    teamArticleScore(home, text),
    teamArticleScore(away, text)
  );
}

function teamArticleScore(teamName: string, articleText: string) {
  const aliases = teamArticleAliases(teamName);
  if (!aliases.length) return 0;

  const paddedText = " " + articleText + " ";

  return aliases.reduce((score, alias) => {
    const normalizedAlias = normalizeText(alias);
    return paddedText.includes(" " + normalizedAlias + " ")
      ? score + 1
      : score;
  }, 0);
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
    return {
      results: [],
      upcoming: [],
      selectedLeague: null,
      provider: { apiFootball: false, sportmonks: false },
      fetchedAt: new Date().toISOString(),
    };
  }

  try {
    const [yesterday, today, articleBuckets] = await Promise.all([
      apiFootballGet("/fixtures", { date: localYesterday(), timezone: STOCKHOLM_TIME_ZONE }),
      apiFootballGet("/fixtures", { date: localToday(), timezone: STOCKHOLM_TIME_ZONE }),
      getCachedArticles(),
    ]);

    const sportArticles: SportArticle[] = [
      ...(articleBuckets.elfsborg ?? []),
      ...(articleBuckets.fotboll ?? []),
      ...(articleBuckets.sport ?? []),
      ...(articleBuckets.tennis ?? []),
    ];

    const yesterdayFinished = (yesterday ?? []).filter(isFinished);

    const relevantYesterday = yesterdayFinished.filter(fixture =>
      isPreferredFixture(fixture) ||
      articleMentionsFixture(fixture, sportArticles) > 0
    );

    const results = relevantYesterday
      .map(mapFixture)
      .filter((item): item is SportResult => item !== null)
      .sort((a, b) => {
        const aImportance =
          fixtureImportance(
            {
              fixture: { date: a.date },
              league: { name: a.league },
              teams: { home: { name: a.home }, away: { name: a.away } },
            },
            articleMentionsFixture(
              {
                teams: {
                  home: { name: a.home },
                  away: { name: a.away },
                },
                league: { name: a.league },
              },
              sportArticles
            )
          );
        const bImportance =
          fixtureImportance(
            {
              fixture: { date: b.date },
              league: { name: b.league },
              teams: { home: { name: b.home }, away: { name: b.away } },
            },
            articleMentionsFixture(
              {
                teams: {
                  home: { name: b.home },
                  away: { name: b.away },
                },
                league: { name: b.league },
              },
              sportArticles
            )
          );
        return bImportance - aImportance || new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .slice(0, 6);

    const todayUpcoming = (today ?? []).filter(
      fixture =>
        !isFinished(fixture) &&
        new Date(fixture.fixture?.date ?? "").getTime() > Date.now() &&
        (
          isRelevantUpcomingFixture(fixture) ||
          articleMentionsFixture(fixture, sportArticles) > 0
        )
    );

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
        importance: fixtureImportance(
          fixture,
          articleMentionsFixture(fixture, sportArticles)
        ),
        source: "API-Football" as const,
      }))
      .sort((a, b) => b.importance - a.importance || new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 6);

    const enrichedResults = await enrichElfsborg(
      results,
      localYesterday(),
      localToday()
    );

    const selectedLeague = await fetchSelectedLeagueTable(
      enrichedResults
    );

    return {
      results: enrichedResults,
      upcoming,
      selectedLeague,
      provider: { apiFootball: true, sportmonks: Boolean(process.env.SPORTMONKS_TOKEN) },
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Sportdata misslyckades:", error);
    return {
      results: [],
      upcoming: [],
      selectedLeague: null,
      provider: {
        apiFootball: true,
        sportmonks: Boolean(process.env.SPORTMONKS_TOKEN),
      },
      fetchedAt: new Date().toISOString(),
    };
  }
}

