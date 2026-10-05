import { getReaderProfile } from "@/lib/readerProfile";
import { getWeeklyReadLinks } from "@/lib/weeklyRead";
import { createWeeklyFocus } from "@/lib/weekFocus";
import { WeeklyStoryLink } from "@/app/components/WeeklyStoryLink";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

export default async function WeekFocusPage() {
  const [profile, readLinks] = await Promise.all([
    getReaderProfile(),
    getWeeklyReadLinks(),
  ]);

  const focus = await createWeeklyFocus(profile, readLinks);

  return (
    <main className="min-h-screen bg-[#f4f1e8] text-slate-950">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-5 md:px-8 md:pt-7">
        <header className="border-y-2 border-slate-950 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                Glenn News · Fördjupning
              </div>
              <h1 className="mt-1 font-serif text-5xl font-black tracking-[-0.04em] md:text-7xl">
                VECKOFOKUS
              </h1>
              <p className="mt-2 max-w-2xl font-serif text-lg leading-7 text-slate-600">
                Tio texter för att förstå veckan. Morgonens nyhetsarbete blir här en redaktionell återblick med mer perspektiv och fördjupning.
              </p>
            </div>

            <div className="text-sm md:text-right">
              <div className="font-bold">{formatDate(focus.periodStart)}–{formatDate(focus.periodEnd)}</div>
              <div className="mt-1 text-slate-500">
                {focus.stories.length} texter kvar att läsa
              </div>
            </div>
          </div>
        </header>

        <div className="mt-5 flex items-center justify-between border-b border-slate-400 pb-3">
          <a href="/" className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 hover:text-slate-950">
            ← Till morgontidningen
          </a>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Läs en text · den försvinner
          </span>
        </div>

        <section className="mt-7 border-b-2 border-slate-950 pb-7">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-700">
            Veckan i korthet
          </div>
          <p className="mt-3 max-w-4xl font-serif text-xl leading-9 text-slate-800 md:text-2xl">
            {focus.summary}
          </p>
        </section>

        {focus.stories.length > 0 ? (
          <div className="mt-8">
            {focus.stories.map(story => (
              <WeeklyStoryLink
                key={story.link}
                href={story.link}
                className="group block border-b border-slate-300 py-6"
              >
                <div className="grid gap-5 md:grid-cols-[64px_0.28fr_1fr_0.9fr] md:items-start">
                  <div className="font-serif text-4xl font-black text-slate-300">
                    {String(story.id).padStart(2, "0")}
                  </div>

                  {story.image ? (
                    <div className="overflow-hidden bg-slate-200">
                      <img
                        src={story.image}
                        alt=""
                        loading="lazy"
                        className="aspect-[16/9] h-auto w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[16/9] items-center justify-center bg-slate-800 font-serif text-sm font-bold text-white/80">
                      Glenn News
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-700">
                      {story.articleType} · {story.source}
                    </div>
                    <h2 className="mt-2 font-serif text-2xl font-black leading-tight tracking-[-0.015em] md:text-3xl group-hover:underline">
                      {story.title}
                    </h2>
                    {story.aiSummary && (
                      <p className="mt-3 font-serif text-base leading-7 text-slate-600">
                        {story.aiSummary}
                      </p>
                    )}
                  </div>

                  <div className="font-serif text-sm leading-6 text-slate-600 md:pt-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Därför är den med
                    </div>
                    <p className="mt-1">{story.selectionReason}</p>
                  </div>
                </div>
              </WeeklyStoryLink>
            ))}
          </div>
        ) : (
          <section className="mt-10 border-y-2 border-slate-950 py-12 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">
              Läskön är tom
            </div>
            <h2 className="mt-2 font-serif text-3xl font-black">
              Du är ikapp.
            </h2>
            <p className="mx-auto mt-3 max-w-xl font-serif text-lg leading-7 text-slate-600">
              Det finns inga fler olästa texter i Veckofokus just nu. När nya veckoberättelser blir aktuella kan nya texter fyllas på.
            </p>
          </section>
        )}

        <footer className="pt-6 text-sm leading-6 text-slate-500">
          Veckofokus bygger just nu på artiklar från de senaste sju dagarna. Nästa steg är att spara morgonens editioner så att veckoredaktören kan använda exakt vad som valdes och sammanfattades varje morgon som historiskt underlag.
        </footer>
      </div>
    </main>
  );
}