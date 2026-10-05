import { getQuote } from "@/lib/quotes";

export function QuoteDivider({
  sectionKey,
  index,
}: {
  sectionKey: string;
  index: number;
}) {
  const quote = getQuote(sectionKey, index);

  return (
    <aside className="py-7 md:py-8">
      <div className="mx-auto max-w-4xl border-y border-slate-300 px-4 py-5 text-center md:px-8">
        <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-slate-400">
          Ett ord på vägen
        </div>
        <blockquote className="mt-3 font-serif text-xl font-black leading-tight tracking-[-0.01em] text-slate-800 md:text-2xl">
          “{quote.text}”
        </blockquote>
        <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {quote.person}
          {quote.context ? " · " + quote.context : ""}
        </div>
      </div>
    </aside>
  );
}
