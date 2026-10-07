import type { SportDayData } from "@/lib/sportDay";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

function Table({ data }: { data: NonNullable<SportDayData["selectedLeague"]> }) {
  const relatedTeams = new Set([
    data.relatedResult.home,
    data.relatedResult.away,
  ]);

  if (!data.rows.length) {
    return (
      <div className="border-y border-slate-300 py-4 text-sm text-slate-500">
        <p className="font-serif">
          Tabellen för {data.title} kunde inte hämtas just nu.
        </p>
        {data.error && (
          <p className="mt-1 text-xs">{data.error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-400 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
            <th className="w-7 py-2 text-left">#</th>
            <th className="px-2 py-2 text-left">Lag</th>
            <th className="px-1 py-2 text-center">M</th>
            <th className="px-1 py-2 text-center">V</th>
            <th className="px-1 py-2 text-center">O</th>
            <th className="px-1 py-2 text-center">F</th>
            <th className="px-1 py-2 text-center">+/-</th>
            <th className="px-1 py-2 text-center">P</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map(row => {
            const related = relatedTeams.has(row.team);

            return (
              <tr
                key={String(row.teamId ?? row.team) + "-" + String(row.rank)}
                className={
                  "border-b border-slate-200 " +
                  (related ? "bg-[#ece7d8] font-semibold" : "")
                }
              >
                <td className="py-2 font-bold text-slate-500">{row.rank}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2 font-serif font-bold">
                    {row.logo ? (
                      <img
                        src={row.logo}
                        alt=""
                        className="h-4 w-4 object-contain"
                        loading="lazy"
                      />
                    ) : null}
                    <span>{row.team}</span>
                  </div>
                </td>
                <td className="px-1 py-2 text-center tabular-nums">{row.played}</td>
                <td className="px-1 py-2 text-center tabular-nums">{row.wins}</td>
                <td className="px-1 py-2 text-center tabular-nums">{row.draws}</td>
                <td className="px-1 py-2 text-center tabular-nums">{row.losses}</td>
                <td className="px-1 py-2 text-center tabular-nums">{row.goalDifference}</td>
                <td className="px-1 py-2 text-center font-black tabular-nums">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {data.error && (
        <p className="mt-2 text-xs text-slate-500">{data.error}</p>
      )}
    </div>
  );
}

function Scorers({ data }: { data: NonNullable<SportDayData["selectedLeague"]> }) {
  if (!data.scorers.length) {
    return (
      <div className="border-l-2 border-slate-950 pl-4 text-sm text-slate-500">
        Skytteligan kunde inte hämtas just nu.
      </div>
    );
  }

  return (
    <aside className="border-l-2 border-slate-950 pl-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        Skytteliga · topp 3
      </div>
      <div className="mt-3 space-y-3">
        {data.scorers.map((player, index) => (
          <div
            key={player.name + "-" + player.team}
            className="flex items-center gap-3 border-b border-slate-200 pb-3 last:border-b-0"
          >
            <div className="font-serif text-xl font-black text-slate-300">
              {index + 1}
            </div>
            {player.photo ? (
              <img
                src={player.photo}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
                loading="lazy"
              />
            ) : null}
            <div className="min-w-0">
              <div className="font-serif font-bold">{player.name}</div>
              <div className="text-xs text-slate-500">{player.team}</div>
            </div>
            <div className="ml-auto font-serif text-xl font-black tabular-nums">
              {player.goals}
            </div>
          </div>
        ))}
      </div>
      {data.error && (
        <p className="mt-3 text-xs text-slate-500">{data.error}</p>
      )}
    </aside>
  );
}

export function SportDayPanel({ data }: { data: SportDayData }) {
  if (!data.provider.apiFootball) {
    return (
      <div className="border-y border-slate-300 py-4 text-sm text-slate-500">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Sportdygn
        </div>
        <p className="mt-2 font-serif text-base">
          Sportdata är inte ansluten ännu. Lägg till <code>API_FOOTBALL_KEY</code> i Vercel för att aktivera resultat, dagens matcher och ligatabell.
        </p>
      </div>
    );
  }

  return (
    <div className="border-y border-slate-300 py-5">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
            Resultat igår
          </div>
          <div className="mb-1 text-xs text-slate-400">
            Färdiga matcher från föregående kalenderdag
          </div>
          <div className="mt-3 space-y-4">
            {data.results.length > 0 ? (
              data.results.slice(0, 4).map(result => (
                <div
                  key={result.id}
                  className="border-b border-slate-200 pb-3 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        {result.league} · {formatDate(result.date)}
                      </div>
                      <div className="mt-1 font-serif text-lg font-black">
                        {result.home}{" "}
                        <span className="text-slate-400">–</span>{" "}
                        {result.away}
                      </div>
                    </div>
                    <div className="shrink-0 font-serif text-2xl font-black">
                      {result.homeScore}–{result.awayScore}
                    </div>
                  </div>
                  {result.goals.length > 0 && (
                    <div className="mt-2 text-xs leading-5 text-slate-600">
                      {result.goals.slice(0, 5).map((goal, index) => (
                        <div key={index}>
                          <span className="font-bold">{goal.minute}'</span>{" "}
                          {goal.player}
                          {goal.assist ? " (" + goal.assist + ")" : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="font-serif text-sm text-slate-500">
                Inga utvalda resultat från igår.
              </p>
            )}
          </div>
        </div>

        <div className="border-l-0 border-slate-300 md:border-l md:pl-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-700">
            Utvalda matcher idag
          </div>
          <div className="mb-1 text-xs text-slate-400">
            Prioriterar Elfsborg, Sverige och stora europeiska matcher
          </div>
          <div className="mt-3 space-y-3">
            {data.upcoming.length > 0 ? (
              data.upcoming.slice(0, 5).map(match => (
                <div
                  key={match.id}
                  className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {match.league}
                    </div>
                    <div className="mt-1 font-serif font-bold">
                      {match.home} – {match.away}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-bold">
                      {formatTime(match.date)}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      idag
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="font-serif text-sm text-slate-500">
                Inga utvalda stora matcher hittades idag.
              </p>
            )}
          </div>
        </div>
      </div>

      {data.selectedLeague && (
        <section className="mt-7 border-t-2 border-slate-950 pt-5">
          <div className="flex flex-col gap-1 border-b border-slate-300 pb-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-yellow-700">
                Dagens tabell
              </div>
              <h3 className="mt-1 font-serif text-2xl font-black">
                {data.selectedLeague.title}
              </h3>
            </div>
            <div className="text-xs text-slate-500 md:text-right">
              <div>
                Kopplad till gårdagens resultat:{" "}
                <span className="font-bold text-slate-700">
                  {data.selectedLeague.relatedResult.home} –{" "}
                  {data.selectedLeague.relatedResult.away}
                </span>
              </div>
              <div className="mt-1">
                Säsong {data.selectedLeague.season}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-[1fr_240px]">
            <Table data={data.selectedLeague} />
            <Scorers data={data.selectedLeague} />
          </div>
        </section>
      )}
    </div>
  );
}
