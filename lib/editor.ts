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

  const candidates = rankedArticles.map(
    (article, index) => ({
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
    })
  );

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
8. Övrig sport
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
3. Rangordna de 16 viktigaste artiklarna.
4. Skriv en kort sammanfattning för varje vald artikel.

Sammanfattningarna ska:

- vara max 2 meningar
- beskriva vad som hänt
- inte innehålla clickbait

Lägesbilden ska vara max 6 meningar.

Returnera ENDAST giltig JSON.

{
  "summary": "...",
  "mainStoryId": 0,
  "topStories": [
    {
      "id": 0,
      "summary": "Kort sammanfattning"
    }
  ]
}

Artiklar:

${JSON.stringify(candidates)}
`,
    });

  let result: any;

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
      candidates
        .slice(0, 16)
        .map(story => ({
          ...story,
          aiSummary:
            story.description ?? "",
        }));

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
        fallbackTopStories.filter(
          story =>
            story.id !==
            fallbackMainStory?.id
        ),
    };
  }

  const mainStory =
    candidates.find(
      item =>
        item.id ===
        result.mainStoryId
    ) ?? candidates[0];

  const topStories =
  result?.topStories
      ?.map((story: any) => {
        const article =
          candidates.find(
            item =>
              item.id === story.id
          );

        if (!article) {
          return null;
        }

        return {
          ...article,
          aiSummary:
            story.summary ?? "",
        };
      })
      .filter(Boolean) ?? [];

const filteredTopStories =
  topStories.filter(
    (story: any) =>
      story?.id !==
      mainStory?.id
  );

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
    filteredTopStories.map(
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

  const mainStorySummary =
  result?.topStories?.find(
      (story: any) =>
        story.id ===
        mainStory?.id
    )?.summary ?? "";

  return {
    summary:
      result.summary ?? "",
    mainStory: {
      ...mainStory,
      aiSummary:
        mainStorySummary,
    },
    topStories:
      filteredTopStories,
  };
}
