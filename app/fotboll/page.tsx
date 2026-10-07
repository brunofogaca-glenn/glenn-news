import { getCachedFootballTables } from "@/lib/footballTables";
import { FootballCompetitionCard } from "@/app/components/FootballCompetitionCard";

export const dynamic = "force-dynamic";

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

const CATEGORY_ORDER = [
  "Sverige",
  "England",
  "Spanien",
  "Italien",
  "Europa",
  "Landslag",
] as const;

export default async function FootballPage() {
  const data = await getCachedFootballTables();

  const grouped = CATEGORY_ORDER.map(category => ({
    category,
    competitions: data.competitions.filter(item => item.category === category),
  })).filter(group => group.competitions.length > 0);

  return (
    <main className="min-h-screen bg-[#f4f1e8] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-5 md:px-8 md:pt-7">
        <header className="border-y-2 border-slate-950 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                Glenn News · Fotboll
              </div>
              <h1 className="mt-1 font-serif text-5xl font-black tracking-[-0.04em] md:text-7xl">
                FOTBOLLSTABELLER
              </h1>
              <p className="mt-2 max-w-3xl font-serif text-lg leading-7 text-slate-600">
                Alla lag i de viktigaste tävlingarna · topp 3 i skytteligan ·
                uppdateras varje morgon
              </p>
            </div>

            <div className="text-sm md:text-right">
              <div className="font-bold">Senast uppdaterad</div>
              <div className="mt-1 text-slate-500">
                {formatUpdated(data.fetchedAt)}
              </div>
            </div>
          </div>
        </header>

        <div className="mt-3 flex items-center justify-between border-b border-slate-400 pb-3">
          <a
            href="/"
            className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 hover:text-slate-950"
          >
            ← Till morgontidningen
          </a>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Dagens tabeller
          </span>
        </div>

        <div className="mt-8 space-y-12">
          {grouped.map(group => (
            <section key={group.category}>
              <div className="mb-4 border-b-2 border-slate-950 pb-2">
                <h2 className="font-serif text-3xl font-black md:text-4xl">
                  {group.category}
                </h2>
              </div>

              <div className="space-y-7">
                {group.competitions.map(competition => (
                  <FootballCompetitionCard
                    key={competition.key}
                    competition={competition}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="pt-8">
          <div className="border-t-2 border-slate-950 pt-4 text-sm leading-6 text-slate-500 md:flex md:justify-between md:gap-8">
            <p>
              Tabeller och skytteligor hämtas från API-Football och uppdateras
              en gång per dag.
            </p>
            <p className="mt-2 md:mt-0 md:text-right">
              Glenn News · Fotboll
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
