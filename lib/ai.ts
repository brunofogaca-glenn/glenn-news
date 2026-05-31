import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function createFrontPage(
  articles: any[]
) {
  const simplified = articles.map(article => ({
    title: article.title,
    description: article.description,
    source: article.source,
    link: article.link,
  }));

  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: `
Du är chefredaktör för Glenn News.

Användaren är främst intresserad av:

🔥 Elfsborg
📍 Borås & Sjuhärad
🇸🇪 Sverige
🌍 Världen
💼 Ekonomi & Näringsliv
⚽ Fotboll
🎾 Tennis
🏅 Övrig sport
🎭 Kultur, Mat & Livsstil

Analysera artiklarna.

Returnera ENDAST giltig JSON enligt detta format:

{
  "editorSummary": "kort sammanfattning",
  "categories": {
    "🔥 Elfsborg": [],
    "📍 Borås & Sjuhärad": [],
    "🇸🇪 Sverige": [],
    "🌍 Världen": [],
    "💼 Ekonomi & Näringsliv": [],
    "⚽ Fotboll": [],
    "🎾 Tennis": [],
    "🏅 Övrig sport": [],
    "🎭 Kultur, Mat & Livsstil": []
  }
}

Regler:

- Välj ut de viktigaste artiklarna
- Placera varje artikel i EN kategori
- Ignorera ointressanta artiklar
- Max 10 artiklar per kategori

Artiklar:

${JSON.stringify(simplified)}
`,
  });

  const text = response.output_text;

  return JSON.parse(text);
}