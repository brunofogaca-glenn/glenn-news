import type { MarketDay } from "@/lib/marketDay";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
  }).format(new Date(date + "T12:00:00Z"));
}

export function MarketDayPanel({ data }: { data: MarketDay }) {
  return (
    <section className="border-y border-slate-300 bg-[#ece7d8] px-4 py-4 md:px-5 md:py-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-800">
            Marknaden · senaste handelsdagen
          </div>
          <div className="mt-1 font-serif text-xl font-black md:text-2xl">
            Rörelser på världens börser
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Stängningar {formatDate(data.date)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4 md:grid-cols-7">
          {data.indices.map(index => (
            <div key={index.symbol} className="border-l border-slate-400 pl-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {index.name}
              </div>
              <div className="mt-1 font-serif text-lg font-black tabular-nums">
                {index.value.toLocaleString("sv-SE", { maximumFractionDigits: 2 })}
              </div>
              <div className={
                "text-xs font-bold tabular-nums " +
                (index.changePct > 0 ? "text-emerald-700" : index.changePct < 0 ? "text-red-700" : "text-slate-500")
              }>
                {index.changePct > 0 ? "+" : ""}{index.changePct.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 border-t border-slate-300 pt-2 text-[9px] uppercase tracking-[0.14em] text-slate-400">
        Källa: Yahoo Finance · indexdata · ej realtid
      </div>
    </section>
  );
}
