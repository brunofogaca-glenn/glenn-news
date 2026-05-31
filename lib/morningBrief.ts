import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function createMorningBrief(
  news: any
) {
  const briefingData = {
    elfsborg: news.elfsborg
      .slice(0, 10)
      .map((article: any) => ({
        title: article.title,
        description:
          article.description ?? "",
        score: article.score ?? 0,
        mentions:
          article.mentions ?? 1,
      })),

    boras: news.boras
      .slice(0, 10)
      .map((article: any) => ({
        title: article.title,
        description:
          article.description ?? "",
        score: article.score ?? 0,
        mentions:
          article.mentions ?? 1,
      })),

    sverige: news.sverige
      .slice(0, 10)
      .map((article: any) => ({
        title: article.title,
        description:
          article.description ?? "",
        score: article.score ?? 0,
        mentions:
          article.mentions ?? 1,
      })),

    varlden: news.varlden
      .slice(0, 10)
      .map((article: any) => ({
        title: article.title,
        description:
          article.description ?? "",
        score: article.score ?? 0,
        mentions:
          article.mentions ?? 1,
      })),

    ekonomi: news.ekonomi
      .slice(0, 10)
      .map((article: any) => ({
        title: article.title,
        description:
          article.description ?? "",
        score: article.score ?? 0,
        mentions:
          article.mentions ?? 1,
      })),

    fotboll: news.fotboll
      .slice(0, 10)
      .map((article: any) => ({
        title: article.title,
        description:
          article.description ?? "",
        score: article.score ?? 0,
        mentions:
          article.mentions ?? 1,
      })),

    tennis: news.tennis
      .slice(0, 10)
      .map((article: any) => ({
        title: article.title,
        description:
          article.description ?? "",
        score: article.score ?? 0,
        mentions:
          article.mentions ?? 1,
      })),

    sport: news.sport
      .slice(0, 10)
      .map((article: any) => ({
        title: article.title,
        description:
          article.description ?? "",
        score: article.score ?? 0,
        mentions:
          article.mentions ?? 1,
      })),

    livsstil: news.livsstil
      .slice(0, 10)
      .map((article: any) => ({
        title: article.title,
        description:
          article.description ?? "",
        score: article.score ?? 0,
        mentions:
          article.mentions ?? 1,
      })),
  };

  const response =
    await openai.responses.create({
      model: "gpt-5-mini",

      input: `
Du är chefredaktör för Glenn News.

Målet är att skapa Sveriges bästa personliga morgonbrief.

Du skriver INTE som en AI.
Du skriver som en erfaren nyhetschef.

VIKTIGA REGLER

- Nämn inte källor om det inte är nödvändigt.
- Skriv vad som händer, inte vem som skrev det.
- Använd score och mentions för att förstå vad som är viktigt.
- Om flera artiklar handlar om samma sak är det extra viktigt.
- Sammanfatta utvecklingen och läget.
- Undvik att rada upp rubriker.
- Ingen kategori får hoppas över.
- Korta stycken.
- Skriv på naturlig svenska.

FORMAT

☀️ GOD MORGON GLENN

🔥 Dagens tio viktigaste teman

1.
2.
3.
4.
5.
6.
7.
8.
9.

────────────────

🔥 Elfsborg
4-6 meningar.

📍 Borås & Sjuhärad
4-6 meningar.

🇸🇪 Sverige
4-6 meningar.

🌍 Världen
4-6 meningar.

💼 Ekonomi & Näringsliv
4-6 meningar.

⚽ Fotboll
4-6 meningar. (Inga Elfsborgsnyheter här)

🎾 Tennis
4-6 meningar.

🏅 Övrig sport
4-6 meningar. (Här måste du sortera bort fotbollsnyheter)

🎭 Kultur, Mat & Livsstil
4-6 meningar.

Målet är att användaren ska förstå dagens nyhetsläge på 120 sekunder.

DATA:

${JSON.stringify(
  briefingData,
  null,
  2
)}
`,
    });

  return response.output_text;
}
