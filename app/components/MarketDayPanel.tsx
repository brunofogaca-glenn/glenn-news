import type { MarketDay } from "@/lib/marketDay";

function changeLabel(value: number) {
  return (value > 0 ? "+" : "") + value.toFixed(2) + "%";
}

export function MarketDayPanel({ data }: { data: MarketDay }) {
  const stockholm = data.indices.find(index => index.symbol === "^OMX");
  const international = data.indices.filter(index => index.symbol !== "^OMX");

  return (
    <section className="border-y border-slate-300 bg-[#ece7d8] px-4 py-4 md:px-5 md:py-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="shrink-0 md:min-w-[300px]">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-800">
            Marknaden · senaste handelsdagen
          </div>
          <div className="mt-1 font-serif text-xl font-black md:text-2xl">
            Börsen igår
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Bara dagsrörelsen · procent
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-5">
          {stockholm && (
            <div className="min-w-[150px] border-l-2 border-slate-950 pl-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Stockholm
              </div>
              <div className={
                "mt-1 font-serif text-2xl font-black tabular-nums " +
                (stockholm.changePct > 0 ? "text-emerald-700" : stockholm.changePct < 0 ? "text-red-700" : "text-slate-500")
              }>
                {changeLabel(stockholm.changePct)}
              </div>
            </div>
          )}

          {international.map(index => (
            <div key={index.symbol} className="border-l border-slate-400 pl-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {index.name}
              </div>
              <div className={
                "mt-1 font-serif text-xl font-black tabular-nums " +
                (index.changePct > 0 ? "text-emerald-700" : index.changePct < 0 ? "text-red-700" : "text-slate-500")
              }>
                {changeLabel(index.changePct)}
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
