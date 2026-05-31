import OpenAI from "openai";
import { rankArticles } from "./ranker";
import { getOgImage } from "./articleImage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function createCategorySummary(
  categoryName: string,
  articles: any[]
) {
  if (!articles.length) {
    return {
      summary: "",
      mainStory: null,
      topStories: [],
    };
  }

  const rankedArticles = rankArticles(
    articles
  );

  const candidates = rankedArticles
    .slice(0, 50)
    .map((article, index) => ({
      id: index,
      title: article.title,
      description:
        article.description ?? "",
      source: article.source,
      link: article.link ?? "",
      image: article.image ?? null,
      date: article.date,
      score: article.score,
      mentions: article.mentions,
    }));

  const response =
    await openai.responses.create({
      model: "gpt-5-mini",
      input: `
Du är chefredaktör för Glenn News.

Kategori:
${categoryName}

Användaren prioriterar:

1. Elfsborg
2. Borås & Sjuhärad
3. Svensk fotboll
4. Sverige
5. Ekonomi
6. Världen
7. Tennis
8. Övrig sport (Här måste du sortera bort fotbolls- och tennisnyheter och fokusera på all annan sport som exempelvis vintersport, formel 1, hockey och trav)
9. Kultur, mat, resor och livsstil

Varje artikel har:

score = maskinellt beräknad relevans

mentions = antal liknande artiklar i olika medier

Välj artiklar som:

- har högt nyhetsvärde
- diskuteras av flera medier
- är aktuella
- påverkar många människor
- passar användarens intressen

Undvik:

- klickbeten
- upprepningar
- identiska historier

Skriv:

1. Ett journalistiskt lägesbildstycke.
2. Välj dagens huvudstory.
3. Rangordna de 10 viktigaste artiklarna.

Lägesbilden ska vara max 6 meningar.

Returnera ENDAST giltig JSON.

{
  "summary": "...",
  "mainStoryId": 0,
  "topStoryIds": [0,1,2,3,4,5,6,7,8,9]
}

Artiklar:

${JSON.stringify(candidates)}
`,
    });

  let result;

  try {
    result = JSON.parse(
      response.output_text
    );
  } catch (error) {
    console.error(
      "Ogiltig JSON från GPT:",
      response.output_text
    );

    const fallbackMainStory =
      candidates[0];

    const fallbackTopStories =
      candidates.slice(0, 5);

    if (
      fallbackMainStory &&
      !fallbackMainStory.image &&
      fallbackMainStory.link
    ) {
      fallbackMainStory.image =
        await getOgImage(
          fallbackMainStory.link
        );
    }

    await Promise.all(
      fallbackTopStories.map(
        async story => {
          if (
            !story.image &&
            story.link
          ) {
            story.image =
              await getOgImage(
                story.link
              );
          }
        }
      )
    );

    return {
      summary:
        "De högst rankade nyheterna har valts automatiskt eftersom AI-sammanfattningen inte kunde genereras.",
      mainStory:
        fallbackMainStory,
      topStories:
        fallbackTopStories,
    };
  }

  const mainStory =
    candidates.find(
      item =>
        item.id ===
        result.mainStoryId
    ) ?? candidates[0];

  const topStories =
    result.topStoryIds
      ?.map((id: number) =>
        candidates.find(
          item => item.id === id
        )
      )
      .filter(Boolean) ?? [];

  if (
    mainStory &&
    !mainStory.image &&
    mainStory.link
  ) {
    mainStory.image =
      await getOgImage(
        mainStory.link
      );
  }

  await Promise.all(
    topStories.map(
      async (story: any) => {
        if (
          story &&
          !story.image &&
          story.link
        ) {
          story.image =
            await getOgImage(
              story.link
            );
        }
      }
    )
  );

  return {
    summary:
      result.summary ?? "",
    mainStory,
    topStories,
  };
}
