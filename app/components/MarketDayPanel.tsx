import type { MarketDay } from "@/lib/marketDay";

function changeLabel(value: number) {
  return (value > 0 ? "+" : "") + value.toFixed(2) + "%";
}

export function MarketDayPanel({ data }: { data: MarketDay }) {
  if (data.indices.length === 0) {
    return null;
  }

  const orderedNames = ["Stockholm", "DAX", "S&P 500", "Nasdaq"];
  const ordered = orderedNames
    .map(name => data.indices.find(index => index.name === name))
    .filter((index): index is NonNullable<typeof index> => Boolean(index));

  return (
    <section className="border-y border-slate-300 bg-[#ece7d8] px-4 py-4 md:px-5 md:py-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="shrink-0 md:min-w-[260px]">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-800">
            Marknaden · senaste handelsdagen
          </div>
          <div className="mt-1 font-serif text-xl font-black md:text-2xl">
            Börsen igår
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Förändring mot föregående handelsdag
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:min-w-[520px]">
          {ordered.map((index, position) => (
            <div
              key={index.symbol}
              className={
                "border-l pl-4 " +
                (position === 0 ? "border-l-2 border-slate-950" : "border-slate-400")
              }
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {index.name}
              </div>
              <div className={
                "mt-1 font-serif text-2xl font-black tabular-nums " +
                (index.changePct > 0 ? "text-emerald-700" : index.changePct < 0 ? "text-red-700" : "text-slate-500")
              }>
                {changeLabel(index.changePct)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 border-t border-slate-300 pt-2 text-[9px] uppercase tracking-[0.14em] text-slate-400">
        Källa: Yahoo Finance · historiska dagsstängningar
      </div>
    </section>
  );
}
