import type { SportDayData } from "@/lib/sportDay";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export function SportDayPanel({ data }: { data: SportDayData }) {
  if (!data.provider.apiFootball) {
    return (
      <div className="border-y border-slate-300 py-4 text-sm text-slate-500">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Sportdygn
        </div>
        <p className="mt-2 font-serif text-base">
          Sportdata är inte ansluten ännu. Lägg till <code>API_FOOTBALL_KEY</code> i Vercel för att aktivera resultat och dagens matcher.
        </p>
      </div>
    );
  }

  return (
    <div className="border-y border-slate-300 py-5">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
            Senaste 24 timmarna
          </div>
          <div className="mt-3 space-y-4">
            {data.results.length > 0 ? data.results.slice(0, 4).map(result => (
              <div key={result.id} className="border-b border-slate-200 pb-3 last:border-b-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{result.league}</div>
                    <div className="mt-1 font-serif text-lg font-black">{result.home} <span className="text-slate-400">–</span> {result.away}</div>
                  </div>
                  <div className="shrink-0 font-serif text-2xl font-black">{result.homeScore}–{result.awayScore}</div>
                </div>
                {result.goals.length > 0 && (
                  <div className="mt-2 text-xs leading-5 text-slate-600">
                    {result.goals.slice(0, 5).map((goal, index) => (
                      <div key={index}>
                        <span className="font-bold">{goal.minute}'</span> {goal.player}{goal.assist ? " (" + goal.assist + ")" : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )) : (
              <p className="font-serif text-sm text-slate-500">Inga utvalda färdiga matcher senaste 24 timmarna.</p>
            )}
          </div>
        </div>

        <div className="border-l-0 border-slate-300 md:border-l md:pl-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-700">
            Dagens matcher
          </div>
          <div className="mt-3 space-y-3">
            {data.upcoming.length > 0 ? data.upcoming.slice(0, 5).map(match => (
              <div key={match.id} className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3 last:border-b-0">
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{match.league}</div>
                  <div className="mt-1 font-serif font-bold">{match.home} – {match.away}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-bold">{formatTime(match.date)}</div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    idag
                  </div>
                </div>
              </div>
            )) : (
              <p className="font-serif text-sm text-slate-500">Inga utvalda stora matcher hittades idag.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}