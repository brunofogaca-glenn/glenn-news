export type ZoneKind =
  | "champions"
  | "europa"
  | "conference"
  | "promotion"
  | "playoff-up"
  | "playoff-down"
  | "relegation"
  | "knockout"
  | "eliminated";

export type LeagueTableZone = {
  fromRank: number;
  toRank: number;
  kind: ZoneKind;
  label: string;
  confirmed: boolean;
};

export type LeagueZoneConfig = {
  seasonStart: number;
  zones: LeagueTableZone[];
  note?: string;
};

const CURRENT_RULES: Record<string, LeagueZoneConfig> = {
  Allsvenskan: {
    seasonStart: 2026,
    zones: [
      { fromRank: 1, toRank: 3, kind: "europa", label: "Europakval · preliminärt", confirmed: false },
      { fromRank: 14, toRank: 14, kind: "playoff-down", label: "Kval mot Superettan", confirmed: true },
      { fromRank: 15, toRank: 16, kind: "relegation", label: "Direkt nedflyttning", confirmed: true },
    ],
    note: "Europazonen är preliminär: Svenska Cupen och UEFA:s accesslista kan flytta platserna. Placering 14 kvalar mot Allsvenskan enligt SvFF:s tävlingsformat.",
  },
  Superettan: {
    seasonStart: 2026,
    zones: [
      { fromRank: 1, toRank: 2, kind: "promotion", label: "Direkt uppflyttning", confirmed: true },
      { fromRank: 3, toRank: 4, kind: "playoff-up", label: "Kval om uppflyttning", confirmed: true },
      { fromRank: 13, toRank: 14, kind: "playoff-down", label: "Kval för att stanna", confirmed: true },
      { fromRank: 15, toRank: 16, kind: "relegation", label: "Direkt nedflyttning", confirmed: true },
    ],
    note: "2026 års SvFF-format: trean och fyran spelar först om att möta Allsvenskans fjortonde lag; placering 13–14 kvalar nedåt.",
  },
  Championship: {
    seasonStart: 2026,
    zones: [
      { fromRank: 1, toRank: 2, kind: "promotion", label: "Direkt uppflyttning", confirmed: true },
      { fromRank: 3, toRank: 6, kind: "playoff-up", label: "Uppflyttningsplayoff", confirmed: true },
      { fromRank: 22, toRank: 24, kind: "relegation", label: "Direkt nedflyttning", confirmed: true },
    ],
    note: "Engelska Championship: två direktplatser upp, platserna 3–6 i playoff och de tre sista lagen flyttas ned.",
  },
  "Premier League": {
    seasonStart: 2026,
    zones: [
      { fromRank: 1, toRank: 5, kind: "champions", label: "Champions League · preliminärt", confirmed: false },
      { fromRank: 6, toRank: 7, kind: "europa", label: "Europa League · preliminärt", confirmed: false },
      { fromRank: 8, toRank: 8, kind: "conference", label: "Conference League · preliminärt", confirmed: false },
      { fromRank: 18, toRank: 20, kind: "relegation", label: "Direkt nedflyttning", confirmed: true },
    ],
    note: "Europeiska streck är en preliminär grundfördelning. UEFA:s extra prestationsplatser, cuper och europeiska titlar kan flytta gränserna; nedflyttningsstrecket är fast.",
  },
  "La Liga": {
    seasonStart: 2026,
    zones: [
      { fromRank: 1, toRank: 4, kind: "champions", label: "Champions League · preliminärt", confirmed: false },
      { fromRank: 5, toRank: 5, kind: "europa", label: "Europa League · preliminärt", confirmed: false },
      { fromRank: 6, toRank: 6, kind: "conference", label: "Conference League · preliminärt", confirmed: false },
      { fromRank: 18, toRank: 20, kind: "relegation", label: "Direkt nedflyttning", confirmed: true },
    ],
    note: "Europeiska platser påverkas av UEFA:s accesslista och cupvinnare och visas därför som preliminära; de tre sista lagen flyttas ned.",
  },
  "Serie A": {
    seasonStart: 2026,
    zones: [
      { fromRank: 1, toRank: 4, kind: "champions", label: "Champions League · preliminärt", confirmed: false },
      { fromRank: 5, toRank: 5, kind: "europa", label: "Europa League · preliminärt", confirmed: false },
      { fromRank: 6, toRank: 6, kind: "conference", label: "Conference League · preliminärt", confirmed: false },
      { fromRank: 18, toRank: 20, kind: "relegation", label: "Direkt nedflyttning", confirmed: true },
    ],
    note: "Europeiska platser påverkas av UEFA:s accesslista och cupvinnare och visas därför som preliminära; de tre sista lagen flyttas ned.",
  },
  "Champions League": {
    seasonStart: 2026,
    zones: [
      { fromRank: 1, toRank: 8, kind: "champions", label: "Direkt till åttondelsfinal", confirmed: true },
      { fromRank: 9, toRank: 24, kind: "playoff-up", label: "Slutspelsplayoff", confirmed: true },
      { fromRank: 25, toRank: 36, kind: "eliminated", label: "Utslagen", confirmed: true },
    ],
    note: "UEFA:s ligafas: placering 1–8 går direkt till åttondelsfinal, 9–24 spelar playoff och 25–36 slås ut.",
  },
};

/** Match only an explicitly configured season. Unknown seasons get no speculative markers. */
export function getLeagueZoneConfig(title: string, season: string): LeagueZoneConfig | null {
  const config = CURRENT_RULES[title];
  if (!config) return null;

  const match = season.match(/20\d{2}/);
  if (!match || Number(match[0]) !== config.seasonStart) return null;

  return config;
}

export function getZoneForRank(zones: LeagueTableZone[], rank: number): LeagueTableZone | undefined {
  return zones.find(zone => rank >= zone.fromRank && rank <= zone.toRank);
}
