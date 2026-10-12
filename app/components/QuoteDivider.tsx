import { getQuote, quoteSourceLicenseUrl } from "@/lib/quotes";

export async function QuoteDivider({
  sectionKey,
  index,
}: {
  sectionKey: string;
  index: number;
}) {
  const quote = await getQuote(sectionKey, index);

  return (
    <aside className="py-7 md:py-8">
      <div className="mx-auto max-w-4xl border-y border-slate-300 px-4 py-5 md:px-8">
        <div className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-slate-400">
          Röster ur historien
        </div>
        <blockquote className="mt-3 text-center font-serif text-lg font-medium leading-relaxed text-slate-800 md:text-xl">
          “{quote.text}”
        </blockquote>
        <div className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          {quote.person}
          {quote.context ? <span className="font-medium normal-case tracking-normal"> · {quote.context}</span> : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[9px] uppercase tracking-[0.12em] text-slate-400">
          <span>
            {quote.poolSize
              ? `Ur ett roterande urval på ${quote.poolSize} citat`
              : "Historiskt reservcitat"}
          </span>
          {quote.sourceUrl ? (
            <a
              href={quote.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
            >
              Källsida: Svenska Wikiquote
            </a>
          ) : null}
          {quote.sourceUrl ? (
            <a
              href={quoteSourceLicenseUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
            >
              CC BY-SA 4.0
            </a>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
