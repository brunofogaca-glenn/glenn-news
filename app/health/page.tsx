import { getFeedHealth } from "@/lib/feedHealth";

export const dynamic = "force-dynamic";

function statusLabel(status: "ok" | "empty" | "error") {
  if (status === "ok") return "OK";
  if (status === "empty") return "Tomt";
  return "FEL";
}

function statusClass(status: "ok" | "empty" | "error") {
  if (status === "ok") {
    return "bg-emerald-100 text-emerald-900";
  }

  if (status === "empty") {
    return "bg-amber-100 text-amber-900";
  }

  return "bg-red-100 text-red-900";
}

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Stockholm",
  }).format(new Date(value));
}

export default async function HealthPage() {
  const health = await getFeedHealth();

  return (
    <main className="min-h-screen bg-[#f4f1e8] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-5 md:px-8 md:pt-7">
        <header className="border-y-2 border-slate-950 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                Glenn News · Drift
              </div>
              <h1 className="mt-1 font-serif text-4xl font-black tracking-[-0.035em] md:text-6xl">
                Flödesstatus
              </h1>
              <p className="mt-2 font-serif text-base text-slate-600">
                Kontrollerar varje RSS- och webbkällas svar, hastighet och
                antal artiklar från senaste 24 timmarna.
              </p>
            </div>

            <a
              href="/health"
              className="inline-flex w-fit border border-slate-500 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700 hover:border-slate-950 hover:text-slate-950"
            >
              ↻ Kör ny kontroll
            </a>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            ["Totalt", health.totals.all],
            ["OK", health.totals.healthy],
            ["Tomt", health.totals.empty],
            ["Fel", health.totals.errors],
          ].map(([label, value]) => (
            <div key={String(label)} className="border border-slate-300 bg-white/40 px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {label}
              </div>
              <div className="mt-1 font-serif text-3xl font-black">
                {value}
              </div>
            </div>
          ))}
        </section>

        <div className="mt-8 border-y-2 border-slate-950">
          <div className="hidden grid-cols-[70px_1.15fr_0.7fr_0.5fr_0.45fr_1.7fr] gap-4 border-b border-slate-300 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 md:grid">
            <div>Status</div>
            <div>Källa</div>
            <div>Kategori</div>
            <div>ms</div>
            <div>24 h</div>
            <div>Detalj</div>
          </div>

          {health.feeds.map((feed) => (
            <div
              key={feed.kind + ":" + feed.url}
              className="grid gap-2 border-b border-slate-300 px-3 py-4 md:grid-cols-[70px_1.15fr_0.7fr_0.5fr_0.45fr_1.7fr] md:items-center md:gap-4"
            >
              <div>
                <span
                  className={
                    "inline-flex px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] " +
                    statusClass(feed.status)
                  }
                >
                  {statusLabel(feed.status)}
                </span>
              </div>

              <div className="min-w-0">
                <div className="font-bold">{feed.name}</div>
                <div className="mt-1 truncate text-xs text-slate-400">
                  {feed.url}
                </div>
              </div>

              <div className="text-sm text-slate-600">{feed.category}</div>
              <div className="text-sm font-mono">{feed.responseMs}</div>
              <div className="text-sm font-bold">{feed.articles24h}</div>
              <div className="text-sm text-slate-600">{feed.detail}</div>
            </div>
          ))}
        </div>

        <footer className="pt-5 text-sm text-slate-500">
          Senast kontrollerad: {formatCheckedAt(health.checkedAt)}
        </footer>
      </div>
    </main>
  );
}
