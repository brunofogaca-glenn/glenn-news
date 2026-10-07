import type { FootballCompetition, FootballGroup } from "@/lib/footballTables";

function categoryAccent(category: FootballCompetition["category"]) {
  switch (category) {
    case "Sverige":
      return "text-yellow-700";
    case "England":
      return "text-red-700";
    case "Spanien":
      return "text-orange-700";
    case "Italien":
      return "text-green-700";
    case "Europa":
      return "text-blue-700";
    case "Landslag":
      return "text-slate-900";
  }
}

function Table({ group }: { group: FootballGroup }) {
  return (
    <div className="overflow-x-auto">
      {group.name !== "Tabell" && (
        <div className="border-b border-slate-300 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {group.name}
        </div>
      )}

      <table className="mt-2 w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-400 text-[9px] font-bold uppercase tracking-[0.13em] text-slate-500">
            <th className="w-8 px-1 py-2 text-left">#</th>
            <th className="px-2 py-2 text-left">Lag</th>
            <th className="px-2 py-2 text-center">M</th>
            <th className="px-2 py-2 text-center">V</th>
            <th className="px-2 py-2 text-center">O</th>
            <th className="px-2 py-2 text-center">F</th>
            <th className="px-2 py-2 text-center">GM</th>
            <th className="px-2 py-2 text-center">IM</th>
            <th className="px-2 py-2 text-center">+/-</th>
            <th className="px-2 py-2 text-center">P</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map(row => (
            <tr key={String(row.teamId ?? row.team) + "-" + String(row.rank)} className="border-b border-slate-200">
              <td className="px-1 py-2 font-bold text-slate-500">{row.rank}</td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-2 font-serif font-bold">
                  {row.logo ? (
                    <img src={row.logo} alt="" className="h-5 w-5 object-contain" loading="lazy" />
                  ) : null}
                  <span>{row.team}</span>
                </div>
              </td>
              <td className="px-2 py-2 text-center tabular-nums">{row.played}</td>
              <td className="px-2 py-2 text-center tabular-nums">{row.wins}</td>
              <td className="px-2 py-2 text-center tabular-nums">{row.draws}</td>
              <td className="px-2 py-2 text-center tabular-nums">{row.losses}</td>
              <td className="px-2 py-2 text-center tabular-nums">{row.goalsFor}</td>
              <td className="px-2 py-2 text-center tabular-nums">{row.goalsAgainst}</td>
              <td className="px-2 py-2 text-center tabular-nums">{row.goalDifference}</td>
              <td className="px-2 py-2 text-center font-bold tabular-nums">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Scorers({ competition }: { competition: FootballCompetition }) {
  if (competition.scorers.length === 0) return null;

  return (
    <aside className="border-l-2 border-slate-950 pl-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        Skytteliga · topp 3
      </div>
      <div className="mt-3 space-y-3">
        {competition.scorers.map((player, index) => (
          <div key={player.name + "-" + player.team} className="flex items-center gap-3 border-b border-slate-200 pb-3 last:border-b-0">
            <div className="font-serif text-xl font-black text-slate-300">
              {index + 1}
            </div>
            {player.photo ? (
              <img src={player.photo} alt="" className="h-10 w-10 rounded-full object-cover" loading="lazy" />
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
    </aside>
  );
}

export function FootballCompetitionCard({ competition }: { competition: FootballCompetition }) {
  return (
    <section className="border-y-2 border-slate-950 bg-[#f4f1e8]">
      <header className="border-b border-slate-300 px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className={"text-[10px] font-bold uppercase tracking-[0.22em] " + categoryAccent(competition.category)}>
              {competition.category}
            </div>
            <h2 className="mt-1 font-serif text-2xl font-black md:text-3xl">
              {competition.title}
            </h2>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {competition.season ? "Säsong " + competition.season : "Säsong saknas"}
          </div>
        </div>
      </header>

      {competition.error && competition.groups.length === 0 ? (
        <div className="px-4 py-6 md:px-5">
          <div className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm">
            <div className="font-bold text-red-800">Kunde inte läsa tabellen</div>
            <div className="mt-1 font-serif text-red-900">{competition.error}</div>
          </div>
          {competition.scorers.length > 0 && (
            <div className="mt-5 max-w-md">
              <Scorers competition={competition} />
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6 px-4 py-5 md:grid-cols-[1fr_250px] md:px-5">
          <div className="space-y-7">
            {competition.groups.map(group => (
              <Table key={group.name} group={group} />
            ))}
          </div>
          <Scorers competition={competition} />
        </div>
      )}
    </section>
  );
}
