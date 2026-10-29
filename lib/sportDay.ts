import { unstable_cache } from "next/cache";
import type { SupplementalRefreshMeta } from "./supplementalCache";


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
  country?: string;
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
  season: string;
  dayLabel: string;
  isSeasonalFallback?: boolean;
  /** Time Glenn News retrieved this table payload; the provider exposes no distinct observation timestamp here. */
  retrievedAt?: string;
  rows: SportLeagueTableRow[];
  scorers: SportLeagueScorer[];
  tableError?: string;
  scorersError?: string;
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
  warnings?: string[];
  refreshMeta?: SupplementalRefreshMeta;
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

const SELECTED_COMPETITION_PRIORITIES = new Map<string, number>([
  ["allsvenskan", 112],
  ["svenska cupen", 110],
  ["superettan", 96],
  ["champions league", 120],
  ["uefa champions league", 120],
  ["europa league", 108],
  ["uefa europa league", 108],
]);

const SWEDEN_NATIONAL_TEAM_NAMES = new Set([
  "sweden",
  "sverige",
  "sweden national team",
  "sweden national football team",
]);

const IMPORTANT_TEAM_PRIORITIES = new Map<string, number>([
  ["if elfsborg", 900],
  ["elfsborg", 900],
  ["norrby if", 880],
  ["norrby", 880],
  ["manchester united", 750],
  ["man united", 750],
  ["man utd", 750],
  ["as roma", 750],
  ["roma", 740],
  ["barcelona", 740],
  ["barca", 730],
  ["sweden", 170],
  ["sverige", 170],
  ["liverpool", 115],
  ["arsenal", 110],
  ["chelsea", 105],
  ["manchester city", 105],
  ["tottenham hotspur", 100],
  ["real madrid", 115],
  ["atletico madrid", 105],
  ["juventus", 105],
  ["inter", 105],
  ["inter milan", 105],
  ["ac milan", 105],
  ["bayern munich", 105],
  ["borussia dortmund", 100],
]);

const PRIORITY_CLUB_NAMES = new Set([
  "if elfsborg",
  "elfsborg",
  "norrby if",
  "norrby",
  "manchester united",
  "man united",
  "man utd",
  "as roma",
  "roma",
  "barcelona",
  "barca",
]);

const TEAM_ARTICLE_ALIASES: Record<string, string[]> = {
  "if elfsborg": ["elfsborg"],
  elfsborg: ["if elfsborg"],
  "norrby if": ["norrby"],
  norrby: ["norrby if"],
  "manchester united": ["man utd", "man united"],
  "man united": ["manchester united", "man utd"],
  "man utd": ["manchester united", "man united"],
  "as roma": ["roma"],
  roma: ["as roma"],
  barcelona: ["barca"],
  barca: ["barcelona"],
  sweden: ["sverige", "svenska landslaget", "herrlandslaget", "landslaget"],
  "hammarby if": ["hammarby"],
  "djurgardens if": ["djurgarden", "djurgardens", "dif"],
  "bk hacken": ["hacken"],
  "malmo ff": ["malmo"],
  brommapojkarna: ["bp"],
};

const STOCKHOLM_DERBY_TEAMS = new Set([
  "aik",
  "hammarby",
  "djurgarden",
  "djurgardens",
  "brommapojkarna",
  "bp",
]);

type MatchArticle = {
  title: string;
  description?: string;
};

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
  return IMPORTANT_TEAM_PRIORITIES.get(normalizeTeamName(name)) ?? 0;
}

function isSwedenNationalTeamFixture(fixture: ApiFootballFixture) {
  const home = normalizeTeamName(fixture.teams?.home?.name ?? "");
  const away = normalizeTeamName(fixture.teams?.away?.name ?? "");
  return SWEDEN_NATIONAL_TEAM_NAMES.has(home) || SWEDEN_NATIONAL_TEAM_NAMES.has(away);
}

function isPriorityClubFixture(fixture: ApiFootballFixture) {
  const home = normalizeTeamName(fixture.teams?.home?.name ?? "");
  const away = normalizeTeamName(fixture.teams?.away?.name ?? "");
  return PRIORITY_CLUB_NAMES.has(home) || PRIORITY_CLUB_NAMES.has(away);
}

function competitionPriorityForFixture(fixture: ApiFootballFixture) {
  const leagueName = normalizeTeamName(fixture.league?.name ?? "");
  const country = normalizeTeamName(fixture.league?.country ?? "");
  const leagueId = fixture.league?.id;

  // "Premier League" exists in many countries. Only accept England's league (ID 39).
  if (leagueName === "premier league") {
    return leagueId === 39 || (leagueId == null && country === "england") ? 106 : 0;
  }

  // The same ambiguity applies to "Championship" outside England.
  if (leagueName === "championship") {
    return leagueId === 40 || (leagueId == null && country === "england") ? 94 : 0;
  }

  if (leagueName === "la liga") {
    return leagueId === 140 || (leagueId == null && country === "spain") ? 102 : 0;
  }

  if (leagueName === "serie a") {
    return leagueId === 135 || (leagueId == null && country === "italy") ? 102 : 0;
  }

  return SELECTED_COMPETITION_PRIORITIES.get(leagueName) ?? 0;
}

function isSelectedSportFixture(fixture: ApiFootballFixture) {
  return (
    isSwedenNationalTeamFixture(fixture) ||
    isPriorityClubFixture(fixture) ||
    competitionPriorityForFixture(fixture) > 0
  );
}

function teamArticleTerms(teamName: string) {
  const normalized = normalizeTeamName(teamName);
  const baseName = normalized
    .replace(/\b(if|ff|fc|afc|fk|ik|bk|sk)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...new Set([
    normalized,
    baseName,
    ...(TEAM_ARTICLE_ALIASES[normalized] ?? []),
  ].map(normalizeTeamName).filter(term => term.length >= 3))];
}

function hasArticleTerm(text: string, term: string) {
  return (" " + text + " ").includes(" " + normalizeTeamName(term) + " ");
}

function isStockholmRivalryFixture(fixture: ApiFootballFixture) {
  const homeIsStockholmTeam = teamArticleTerms(fixture.teams?.home?.name ?? "")
    .some(team => STOCKHOLM_DERBY_TEAMS.has(team));
  const awayIsStockholmTeam = teamArticleTerms(fixture.teams?.away?.name ?? "")
    .some(team => STOCKHOLM_DERBY_TEAMS.has(team));
  return homeIsStockholmTeam && awayIsStockholmTeam;
}

function articlePriorityForFixture(fixture: ApiFootballFixture, articles: MatchArticle[]) {
  const homeTerms = teamArticleTerms(fixture.teams?.home?.name ?? "");
  const awayTerms = teamArticleTerms(fixture.teams?.away?.name ?? "");
  const stockholmDerby = isStockholmRivalryFixture(fixture);
  let score = stockholmDerby ? 300 : 0;

  for (const article of articles) {
    const text = normalizeTeamName(article.title + " " + (article.description ?? ""));
    const mentionsHome = homeTerms.some(term => hasArticleTerm(text, term));
    const mentionsAway = awayTerms.some(term => hasArticleTerm(text, term));

    if (mentionsHome && mentionsAway) {
      score += 220;
    } else if (mentionsHome || mentionsAway) {
      score += 65;
    }

    if (stockholmDerby && /\b(stockholmsderby|stockholm derby|derby|derbyt)\b/.test(text)) {
      score += 120;
    }
  }

  return score;
}

function fixtureImportance(fixture: ApiFootballFixture, articles: MatchArticle[] = []) {
  const home = fixture.teams?.home?.name ?? "";
  const away = fixture.teams?.away?.name ?? "";

  if (isSwedenNationalTeamFixture(fixture)) {
    return 5000 + Math.max(teamPriority(home), teamPriority(away)) +
      articlePriorityForFixture(fixture, articles);
  }

  return (
    competitionPriorityForFixture(fixture) * 10 +
    Math.max(teamPriority(home), teamPriority(away)) * 2 +
    articlePriorityForFixture(fixture, articles)
  );
}

type DailyTableSelection = {
  leagueId: number;
  fotmobLeagueId: number;
  title: string;
  dayLabel: string;
  isSeasonalFallback?: boolean;
  tableGroup?: "norra" | "södra";
};

type MonthDayWindow = readonly [number, number];

type DailyTableSlot = {
  dayLabel: string;
  primary: Omit<DailyTableSelection, "dayLabel">;
  fallback: Omit<DailyTableSelection, "dayLabel">;
  primaryWindow: MonthDayWindow;
  fallbackWindow: MonthDayWindow;
};

// These are intentionally broader than typical competition calendars. The
// windows overlap at season boundaries; the primary league wins in the overlap,
// while the alternate is selected outside the primary season window.
// YYYY is deliberately omitted: this should not need yearly end-date edits.
const TABLE_SEASON_WINDOWS = {
  swedishLeagues: {
    primaryWindow: [401, 1130],
    fallbackWindow: [1101, 415],
  },
  bigEuropeanLeagues: {
    primaryWindow: [801, 531],
    fallbackWindow: [501, 831],
  },
  championsLeague: {
    primaryWindow: [915, 131],
    fallbackWindow: [201, 1015],
  },
} as const satisfies Record<string, { primaryWindow: MonthDayWindow; fallbackWindow: MonthDayWindow }>;

const DAILY_TABLE_SCHEDULE: Record<string, DailyTableSlot> = {
  Monday: {
    dayLabel: "Måndag",
    primary: { leagueId: 113, fotmobLeagueId: 67, title: "Allsvenskan" },
    fallback: { leagueId: 61, fotmobLeagueId: 53, title: "Ligue 1", isSeasonalFallback: true },
    ...TABLE_SEASON_WINDOWS.swedishLeagues,
  },
  Tuesday: {
    dayLabel: "Tisdag",
    primary: { leagueId: 114, fotmobLeagueId: 168, title: "Superettan" },
    fallback: { leagueId: 88, fotmobLeagueId: 57, title: "Eredivisie", isSeasonalFallback: true },
    ...TABLE_SEASON_WINDOWS.swedishLeagues,
  },
  Wednesday: {
    dayLabel: "Onsdag",
    primary: { leagueId: 140, fotmobLeagueId: 87, title: "La Liga" },
    fallback: { leagueId: 1084, fotmobLeagueId: 169, title: "Ettan Norra", isSeasonalFallback: true, tableGroup: "norra" },
    ...TABLE_SEASON_WINDOWS.bigEuropeanLeagues,
  },
  Thursday: {
    dayLabel: "Torsdag",
    primary: { leagueId: 39, fotmobLeagueId: 47, title: "Premier League" },
    fallback: { leagueId: 103, fotmobLeagueId: 59, title: "Norska Eliteserien", isSeasonalFallback: true },
    ...TABLE_SEASON_WINDOWS.bigEuropeanLeagues,
  },
  Friday: {
    dayLabel: "Fredag",
    primary: { leagueId: 40, fotmobLeagueId: 48, title: "Championship" },
    fallback: { leagueId: 1085, fotmobLeagueId: 169, title: "Ettan Södra", isSeasonalFallback: true, tableGroup: "södra" },
    ...TABLE_SEASON_WINDOWS.bigEuropeanLeagues,
  },
  Saturday: {
    dayLabel: "Lördag",
    primary: { leagueId: 135, fotmobLeagueId: 55, title: "Serie A" },
    fallback: { leagueId: 1040, fotmobLeagueId: 9089, title: "Damallsvenskan", isSeasonalFallback: true },
    ...TABLE_SEASON_WINDOWS.bigEuropeanLeagues,
  },
  Sunday: {
    dayLabel: "Söndag",
    primary: { leagueId: 2, fotmobLeagueId: 42, title: "Champions League" },
    fallback: { leagueId: 128, fotmobLeagueId: 112, title: "Liga Profesional Argentina", isSeasonalFallback: true },
    ...TABLE_SEASON_WINDOWS.championsLeague,
  },
};

function stockholmDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STOCKHOLM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find(part => part.type === "year")?.value ?? "0"),
    month: Number(parts.find(part => part.type === "month")?.value ?? "0"),
    day: Number(parts.find(part => part.type === "day")?.value ?? "0"),
  };
}

function isInMonthDayWindow(
  date: { month: number; day: number },
  window: MonthDayWindow
) {
  const value = date.month * 100 + date.day;
  const [start, end] = window;
  // A start greater than the end means the window crosses New Year's Eve.
  return start <= end
    ? value >= start && value <= end
    : value >= start || value <= end;
}

function dailyTableSelection(date = new Date()): DailyTableSelection {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: STOCKHOLM_TIME_ZONE,
    weekday: "long",
  }).format(date);
  const slot = DAILY_TABLE_SCHEDULE[weekday] ?? DAILY_TABLE_SCHEDULE.Monday;
  const stockholmDate = stockholmDateParts(date);
  const primaryActive = isInMonthDayWindow(stockholmDate, slot.primaryWindow);
  const fallbackActive = isInMonthDayWindow(stockholmDate, slot.fallbackWindow);

  // Primary always wins in the deliberately overlapping transition window.
  // Selection is determined only by the configured date schedule, never by
  // whether a provider happens to return rows or considers a season finished.
  const selected = primaryActive || !fallbackActive ? slot.primary : slot.fallback;

  return {
    ...selected,
    dayLabel: slot.dayLabel,
    isSeasonalFallback: Boolean(selected.isSeasonalFallback),
  };
}

type FotMobStandingRow = {
  idx?: number;
  id?: number | string;
  name?: string;
  played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  scoresStr?: string;
  goalConDiff?: number;
  pts?: number;
};

type FotMobTableGroup = {
  name?: string;
  title?: string;
  label?: string;
  shortName?: string;
  data?: {
    leagueId?: number;
    name?: string;
    title?: string;
    leagueName?: string;
    tableName?: string;
    table?: {
      name?: string;
      title?: string;
      all?: FotMobStandingRow[];
    };
  };
};

type FotMobLeaguePayload = {
  details?: {
    selectedSeason?: string;
    latestSeason?: string;
  };
  table?: FotMobTableGroup[];
  stats?: {
    players?: Array<{
      header?: string;
      topThree?: Array<{
        id?: number | string;
        name?: string;
        value?: number | string;
        teamId?: number | string;
        teamName?: string;
        photo?: string;
      }>;
    }>;
  };
};

function normalizeFotMobTableRows(
  groups: FotMobLeaguePayload["table"],
  tableGroup?: "norra" | "södra"
): SportLeagueTableRow[] {
  let selectedGroups = groups ?? [];

  if (tableGroup && selectedGroups.length > 0) {
    const groupText = (group: FotMobTableGroup) => [
      group.name,
      group.title,
      group.label,
      group.shortName,
      group.data?.name,
      group.data?.title,
      group.data?.leagueName,
      group.data?.tableName,
      group.data?.table?.name,
      group.data?.table?.title,
    ].filter(Boolean).join(" ").toLocaleLowerCase("sv-SE").replace(/ö/g, "o");

    const marker = tableGroup === "norra" ? /\bnorra\b/ : /\b(?:sodra|soedra)\b/;
    const matches = selectedGroups.filter(group => marker.test(groupText(group)));

    if (matches.length > 0) {
      selectedGroups = matches;
    } else if (selectedGroups.length >= 2) {
      // Some FotMob payload variants expose two unlabelled table groups.
      // FotMob renders Norra first and Södra second; select one rather than
      // merging the divisions into a misleading 32-team table.
      selectedGroups = [selectedGroups[tableGroup === "norra" ? 0 : 1]];
    } else {
      // Never quietly show a combined/incorrect table if the division cannot
      // be identified in the provider payload.
      selectedGroups = [];
    }
  }

  const rows = selectedGroups.flatMap(group => group.data?.table?.all ?? []);

  return rows
    .filter(row => Boolean(row.name))
    .map((row, index) => {
      const score = (row.scoresStr ?? "").match(/^\s*(\d+)\s*[-–:]\s*(\d+)\s*$/);
      const parsedTeamId = row.id === undefined ? undefined : Number(row.id);
      const teamId = parsedTeamId !== undefined && Number.isFinite(parsedTeamId)
        ? parsedTeamId
        : undefined;

      return {
        rank: row.idx ?? index + 1,
        teamId,
        team: row.name ?? "Okänt lag",
        logo: teamId !== undefined
          ? "https://images.fotmob.com/image_resources/logo/teamlogo/" + teamId + "_small.png"
          : undefined,
        played: row.played ?? 0,
        wins: row.wins ?? 0,
        draws: row.draws ?? 0,
        losses: row.losses ?? 0,
        goalsFor: score ? Number(score[1]) : 0,
        goalsAgainst: score ? Number(score[2]) : 0,
        goalDifference: row.goalConDiff ?? 0,
        points: row.pts ?? 0,
      };
    });
}

function normalizeFotMobScorers(
  stats: FotMobLeaguePayload["stats"],
  rows: SportLeagueTableRow[]
): SportLeagueScorer[] {
  const goalStats = stats?.players?.find(entry =>
    /goal|scorer/i.test(entry.header ?? "") && Array.isArray(entry.topThree)
  );
  if (!goalStats?.topThree?.length) return [];

  const teamNames = new Map(
    rows
      .filter(row => row.teamId !== undefined)
      .map(row => [String(row.teamId), row.team] as const)
  );

  return goalStats.topThree
    .filter(player => Boolean(player.name) && Number.isFinite(Number(player.value)))
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 3)
    .map(player => ({
      name: player.name ?? "Okänd spelare",
      team:
        player.teamName ??
        (player.teamId !== undefined ? teamNames.get(String(player.teamId)) : undefined) ??
        "Okänt lag",
      goals: Number(player.value),
      photo: player.photo,
    }));
}

async function fetchSelectedLeagueTable(): Promise<SportLeagueTable | null> {
  const selected = dailyTableSelection();
  const fallbackSeason = Number(localToday().slice(0, 4)).toString();

  try {
    const url = new URL("https://www.fotmob.com/api/data/leagues");
    url.searchParams.set("id", String(selected.fotmobLeagueId));

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "user-agent": "GlennNews/1.0 (football table)",
        Accept: "application/json",
      },
    });

    if (!response.ok) throw new Error("FotMob returned HTTP " + response.status);
    if (!response.headers.get("content-type")?.includes("json")) {
      throw new Error("FotMob returned a non-JSON response");
    }

    const payload = (await response.json()) as FotMobLeaguePayload;
    const rows = normalizeFotMobTableRows(payload.table, selected.tableGroup);
    const scorers = normalizeFotMobScorers(payload.stats, rows);
    const season =
      payload.details?.selectedSeason ??
      payload.details?.latestSeason ??
      fallbackSeason;

    if (rows.length === 0) {
      console.warn("FotMob returned no standings for the scheduled table", selected.title, season);
    }
    if (scorers.length === 0) {
      console.warn("FotMob returned no top scorers for", selected.title, season);
    }

    // Keep the title and league fixed by the weekday/date schedule even if the
    // current season has ended or the data provider temporarily omits standings.
    return {
      leagueId: selected.leagueId,
      title: selected.title,
      season,
      dayLabel: selected.dayLabel,
      isSeasonalFallback: selected.isSeasonalFallback,
      retrievedAt: new Date().toISOString(),
      rows,
      scorers,
      tableError: rows.length
        ? undefined
        : "FotMob returnerade ingen tabell för det fasta tabellvalet " + selected.title + " (" + season + ").",
      scorersError: scorers.length
        ? undefined
        : "FotMob returnerade ingen aktuell skytteliga för " + selected.title + " säsongen " + season + ".",
    };
  } catch (error) {
    console.error("FotMob tabellhämtning misslyckades:", selected.title, error);
    return {
      leagueId: selected.leagueId,
      title: selected.title,
      season: fallbackSeason,
      dayLabel: selected.dayLabel,
      isSeasonalFallback: selected.isSeasonalFallback,
      rows: [],
      scorers: [],
      tableError: "Den schemalagda tabellen för " + selected.title + " kunde inte hämtas från FotMob just nu.",
      scorersError: "Skytteligan för " + selected.title + " kunde inte hämtas från FotMob just nu.",
    };
  }
}

function apiFootballErrorText(errors: unknown): string {
  if (!errors) return "";

  if (Array.isArray(errors)) {
    return errors.map(value => String(value)).filter(Boolean).join("; ");
  }

  if (typeof errors === "object") {
    return Object.entries(errors as Record<string, unknown>)
      .filter(([, value]) =>
        value !== null &&
        value !== undefined &&
        value !== "" &&
        !(Array.isArray(value) && value.length === 0) &&
        !(typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0)
      )
      .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
      .join("; ");
  }

  return String(errors);
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
  const apiErrors = apiFootballErrorText(data.errors);

  if (apiErrors) {
    throw new Error("API-Football avvisade anropet (" + path + "): " + apiErrors);
  }

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
    country: fixture.league?.country,
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
    const selectedLeague = await fetchSelectedLeagueTable();
    if (!selectedLeague?.rows.length) {
      throw new Error("FotMob returned no usable league table; API-Football is not configured.");
    }
    const warnings = [
      selectedLeague?.tableError ? "Tabell: " + selectedLeague.tableError : null,
      selectedLeague?.scorersError ? "Skytteliga: " + selectedLeague.scorersError : null,
    ].filter((value): value is string => Boolean(value));

    return {
      results: [],
      upcoming: [],
      selectedLeague,
      provider: {
        apiFootball: false,
        sportmonks: Boolean(process.env.SPORTMONKS_TOKEN),
      },
      fetchedAt: new Date().toISOString(),
      warnings,
    };
  }

  try {
    // Keep this data path independent from editorial RSS feeds. Match priority
    // uses stable league and club signals so this panel can refresh from 01:00.
    const [yesterday, today] = await Promise.all([
      apiFootballGet("/fixtures", { date: localYesterday(), timezone: STOCKHOLM_TIME_ZONE }),
      apiFootballGet("/fixtures", { date: localToday(), timezone: STOCKHOLM_TIME_ZONE }),
    ]);

    const matchArticles: MatchArticle[] = [];

    // Rank fixtures by selected competitions, favourite teams, and derby weight.
    // Editorial RSS is intentionally not consulted before the 06:00 article window.
    const results = (yesterday ?? [])
      .filter(fixture => isFinished(fixture) && isSelectedSportFixture(fixture))
      .map(fixture => ({
        fixture,
        importance: fixtureImportance(fixture, matchArticles),
      }))
      .sort((a, b) =>
        b.importance - a.importance ||
        new Date(b.fixture.fixture?.date ?? "").getTime() -
          new Date(a.fixture.fixture?.date ?? "").getTime()
      )
      .slice(0, 12)
      .map(item => item.fixture)
      .map(mapFixture)
      .filter((item): item is SportResult => item !== null);

    const todayUpcoming = (today ?? []).filter(
      fixture =>
        !isFinished(fixture) &&
        new Date(fixture.fixture?.date ?? "").getTime() > Date.now() &&
        isSelectedSportFixture(fixture)
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
        importance: fixtureImportance(fixture, matchArticles),
        source: "API-Football" as const,
      }))
      .sort((a, b) => b.importance - a.importance || new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 12);

    const enrichedResults = await enrichElfsborg(
      results,
      localYesterday(),
      localToday()
    );

    const selectedLeague = await fetchSelectedLeagueTable();

    const warnings = [
      selectedLeague?.tableError ? "Tabell: " + selectedLeague.tableError : null,
      selectedLeague?.scorersError ? "Skytteliga: " + selectedLeague.scorersError : null,
    ].filter((value): value is string => Boolean(value));

    return {
      results: enrichedResults,
      upcoming,
      selectedLeague,
      provider: { apiFootball: true, sportmonks: Boolean(process.env.SPORTMONKS_TOKEN) },
      fetchedAt: new Date().toISOString(),
      warnings,
    };
  } catch (error) {
    console.error("Sportdata misslyckades:", error);
    throw error;
  }
}
