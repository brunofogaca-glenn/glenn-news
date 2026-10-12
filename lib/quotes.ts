import { unstable_cache } from "next/cache";

export type Quote = {
  text: string;
  person: string;
  context?: string;
  sourceUrl?: string;
  poolSize?: number;
};

type WikiquotePage = {
  title: string;
  missing?: boolean;
  revisions?: Array<{
    slots?: {
      main?: {
        content?: string;
      };
    };
    "*"?: string;
  }>;
};

type WikiquoteResponse = {
  query?: {
    pages?: WikiquotePage[];
  };
};

const WIKIQUOTE_API = "https://sv.wikiquote.org/w/api.php";
const WIKIQUOTE_PAGE_BASE = "https://sv.wikiquote.org/wiki/";
const WIKIQUOTE_LICENCE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

const HISTORICAL_PAGES = [
  "Hjalmar Branting", "Per-Albin Hansson", "August Strindberg", "Selma Lagerlöf",
  "Ellen Key", "Elin Wägner", "Karin Boye", "Hjalmar Söderberg", "Viktor Rydberg",
  "Verner von Heidenstam", "Fredrika Bremer", "Gustaf Fröding", "Dan Andersson",
  "Karl Staaff", "Anders Chydenius", "August Palm", "Kata Dalström", "Hinke Bergegren",
  "Frida Stéenhoff", "Clara Zetkin", "Carl von Linné", "Carl Michael Bellman",
  "Esaias Tegnér", "Karl XII", "Karl XIV Johan", "Kristina av Sverige", "Gustav Vasa",
  "Alfred Nobel", "Anders Celsius", "Lars Johan Hierta", "Erik Gustaf Geijer",
  "Johan Olof Wallin", "Henrik Ibsen", "Knut Hamsun", "Bjørnstjerne Bjørnson",
  "Georg Brandes", "Karl Marx", "Friedrich Engels", "Rosa Luxemburg", "Emma Goldman",
  "Vladimir Lenin", "Lev Trotskij", "Antonio Gramsci", "Peter Kropotkin", "Michail Bakunin",
  "William Morris", "John Stuart Mill", "Mary Wollstonecraft", "Mary Shelley", "Jane Austen",
  "George Bernard Shaw", "Virginia Woolf", "George Orwell", "Rabindranath Tagore",
  "Leo Tolstoj", "Fjodor Dostojevskij", "Anton Tjechov", "Aleksandr Pusjkin", "Voltaire",
  "Jean-Jacques Rousseau", "Immanuel Kant", "Søren Kierkegaard", "Baruch Spinoza",
  "Arthur Schopenhauer", "Friedrich Nietzsche", "Blaise Pascal", "Galileo Galilei",
  "Isaac Newton", "Charles Darwin", "Albert Einstein", "Marie Curie", "Nikola Tesla",
  "Ada Lovelace", "Florence Nightingale", "Drottning Victoria", "Otto von Bismarck",
  "Giuseppe Garibaldi", "Giuseppe Mazzini", "Simón Bolívar", "José Martí", "José Rizal",
  "Fredrik den store", "Abraham Lincoln", "Benjamin Franklin", "Thomas Jefferson",
  "George Washington", "Frederick Douglass", "Susan B. Anthony", "Elizabeth Cady Stanton",
  "Emmeline Pankhurst", "Harriet Tubman", "Sojourner Truth", "Thomas Paine",
  "Theodore Roosevelt", "Franklin D. Roosevelt", "Woodrow Wilson", "Ulysses S. Grant",
  "William Lloyd Garrison", "Ralph Waldo Emerson", "Henry David Thoreau", "Walt Whitman",
  "Herman Melville", "Charles Dickens", "William Shakespeare", "Oscar Wilde", "Mark Twain",
  "Victor Hugo", "Émile Zola", "H. G. Wells", "Thomas Edison", "Cicero", "Seneca",
  "Marcus Aurelius", "Platon", "Aristoteles", "Sokrates", "Konfucius", "Lao Zi", "Sun Zi",
  "Mengzi", "Zhuangzi", "Rumi", "Omar Khayyam", "Ibn Khaldun", "Avicenna", "Augustinus",
  "Thomas av Aquino", "Martin Luther", "Erasmus av Rotterdam", "Maimonides", "Aisopos",
  "Herodotos", "Thukydides", "Plutarchos", "Dante Alighieri", "Niccolò Machiavelli",
  "Miguel de Cervantes", "Benjamin Disraeli", "Hugo Grotius", "René Descartes",
  "Francis Bacon", "Nicolaus Copernicus", "Johannes Kepler", "Leonardo da Vinci",
  "Michelangelo", "Rembrandt", "Vincent van Gogh", "Claude Monet", "Ludwig van Beethoven",
  "Johann Sebastian Bach", "Wolfgang Amadeus Mozart", "Richard Wagner", "Molière",
  "Jean de La Fontaine", "Napoleon Bonaparte", "Catherine den stora", "Karl den store",
  "Drottning Kristina", "Alexis de Tocqueville", "Friedrich Schiller", "Johann Wolfgang von Goethe",
  "Gustave Flaubert", "Benjamin Constant", "William Blake", "Robert Burns", "John Keats",
  "Percy Bysshe Shelley", "Lord Byron", "Emily Dickinson", "Henry David Thoreau",
  "W. E. B. Du Bois", "Booker T. Washington", "Ida B. Wells", "William Jennings Bryan",
  "Frederick the Great", "Garibaldi", "Giuseppe Verdi", "Richard Wagner", "George Eliot",
  "Charlotte Brontë", "Emily Brontë", "Charles Fourier", "Pierre-Joseph Proudhon",
  "Louis Blanc", "Eugène Pottier", "August Bebel", "Eduard Bernstein", "Rosa Luxemburg",
  "Henri de Saint-Simon", "Robert Owen", "Flora Tristan", "Louise Michel", "Peter Abelard",
  "Thomas More", "Niccolò Paganini", "Mary Anning", "Joseph Priestley", "Michael Faraday",
  "James Clerk Maxwell", "Louis Pasteur", "Robert Koch", "Gregor Mendel", "Rachel Carson",
  "Hypatia", "Hippokrates", "Demokritos", "Epiktetos", "Plinius den äldre", "Tacitus",
  "Julius Caesar", "Marcus Tullius Cicero", "Thukydides", "Perikles", "Homer",
  "Kahlil Gibran", "Rabindranath Tagore", "José Rizal", "Sun Yat-sen", "Mahatma Gandhi",
  "Jawaharlal Nehru", "José de San Martín", "Benito Juárez", "Toussaint Louverture",
  "Simón Rodríguez", "Bartolomé de las Casas", "Sor Juana Inés de la Cruz",
  "Thomas à Kempis", "Teresa av Ávila", "Johannes Calvin", "John Wesley", "William Penn",
  "Jonathan Swift", "Daniel Defoe", "Samuel Johnson", "Edmund Burke", "Mary Astell",
  "Olympe de Gouges", "Harriet Martineau", "Elizabeth Fry", "Susan B. Anthony",
] as const;

// Small, attributed emergency set if Wikiquote is temporarily unavailable.
const FALLBACK_QUOTES: Quote[] = [
  {
    text: "Frihet är alltid och uteslutande frihet för den som tänker annorlunda.",
    person: "Rosa Luxemburg",
    context: "Den ryska revolutionen",
    sourceUrl: "https://sv.wikiquote.org/wiki/Rosa_Luxemburg",
  },
  {
    text: "Filosoferna har bara tolkat världen på olika sätt. Det gäller att förändra den.",
    person: "Karl Marx",
    context: "Teser om Feuerbach",
    sourceUrl: "https://sv.wikiquote.org/wiki/Karl_Marx",
  },
  {
    text: "Historien om alla hittillsvarande samhällen är historien om klasskamp.",
    person: "Karl Marx och Friedrich Engels",
    context: "Det kommunistiska manifestet, 1848",
    sourceUrl: "https://sv.wikiquote.org/wiki/Karl_Marx",
  },
  {
    text: "Folkets kärlek min belöning.",
    person: "Karl XIV Johan",
    context: "Valspråk",
    sourceUrl: "https://sv.wikiquote.org/wiki/Karl_XIV_Johan",
  },
  {
    text: "Vår beredskap är god.",
    person: "Per Albin Hansson",
    context: "Tal på Skansen, 27 augusti 1939",
    sourceUrl: "https://sv.wikiquote.org/wiki/Per-Albin_Hansson",
  },
  {
    text: "Jag är en demokratisk socialist med stolthet och glädje.",
    person: "Olof Palme",
    context: "Tal vid Socialdemokraternas partikongress, 1982",
    sourceUrl: "https://sv.wikiquote.org/wiki/Olof_Palme",
  },
  {
    text: "Det mest oförlåtliga brottet i samhället är självständigt tänkande.",
    person: "Emma Goldman",
    context: "Anarchism and Other Essays",
    sourceUrl: "https://sv.wikiquote.org/wiki/Emma_Goldman",
  },
  {
    text: "En lång tradition är inte en ursäkt för att aldrig pröva en ny idé.",
    person: "Reservcitat",
    context: "Tillfälligt reservurval",
  },
];

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&#(\d+);/g, (_match, number: string) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, number: string) => String.fromCodePoint(parseInt(number, 16)));
}

function stripWikiMarkup(value: string) {
  let text = value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, " ")
    .replace(/<ref\b[^>]*\/\s*>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|div|li|blockquote)>/gi, " ");

  for (let attempt = 0; attempt < 6 && /\{\{[^{}]*\}\}/.test(text); attempt += 1) {
    text = text.replace(/\{\{[^{}]*\}\}/g, " ");
  }

  text = text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[(?:https?:\/\/\S+)\s+([^\]]+)\]/g, "$1")
    .replace(/\[https?:\/\/[^\]]+\]/g, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/'{2,5}/g, "")
    .replace(/^\s*[*#:;]+\s*/gm, " ")
    .replace(/\s+/g, " ")
    .trim();

  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

function findTemplateEnd(wikitext: string, start: number) {
  let depth = 0;
  for (let index = start; index < wikitext.length - 1; index += 1) {
    const pair = wikitext.slice(index, index + 2);
    if (pair === "{{") {
      depth += 1;
      index += 1;
    } else if (pair === "}}") {
      depth -= 1;
      index += 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}

function splitTopLevelTemplateArgs(body: string) {
  const args: string[] = [];
  let start = 0;
  let templateDepth = 0;
  let linkDepth = 0;

  for (let index = 0; index < body.length; index += 1) {
    const pair = body.slice(index, index + 2);
    if (pair === "{{") {
      templateDepth += 1;
      index += 1;
    } else if (pair === "}}") {
      templateDepth = Math.max(0, templateDepth - 1);
      index += 1;
    } else if (pair === "[[") {
      linkDepth += 1;
      index += 1;
    } else if (pair === "]]") {
      linkDepth = Math.max(0, linkDepth - 1);
      index += 1;
    } else if (body[index] === "|" && templateDepth === 0 && linkDepth === 0) {
      args.push(body.slice(start, index));
      start = index + 1;
    }
  }

  args.push(body.slice(start));
  return args;
}

function extractSourcedQuoteTemplates(wikitext: string, pageTitle: string): Quote[] {
  const headings = [...wikitext.matchAll(/^={2,5}\s*(.*?)\s*={2,5}\s*$/gm)].map(match => ({
    index: match.index ?? 0,
    title: stripWikiMarkup(match[1] ?? ""),
  }));
  const entries: Quote[] = [];
  const pattern = /\{\{\s*citat\s*\|/gi;
  let match: RegExpExecArray | null;
  let headingIndex = 0;

  while ((match = pattern.exec(wikitext)) !== null) {
    const start = match.index;
    const end = findTemplateEnd(wikitext, start);
    if (end < 0) break;

    while (headingIndex + 1 < headings.length && headings[headingIndex + 1].index < start) {
      headingIndex += 1;
    }
    const heading = headings[headingIndex]?.title ?? "";

    // Avoid quotations about the author, unsourced quote lists, and navigation/reference sections.
    if (/\b(andra personer om|felaktiga citat|påstådda citat|externa länkar|referenser|källor|se även|vidare läsning)\b/i.test(heading)) {
      pattern.lastIndex = end;
      continue;
    }

    const rawBody = wikitext.slice(start + 2, end - 2);
    const args = splitTopLevelTemplateArgs(rawBody);
    if (stripWikiMarkup(args[0] ?? "").toLowerCase() !== "citat") {
      pattern.lastIndex = end;
      continue;
    }

    const text = stripWikiMarkup(args[1] ?? "");
    const context = stripWikiMarkup(args.slice(2).join(" | "));
    if (text.length < 45 || text.length > 1100 || context.length < 8) {
      pattern.lastIndex = end;
      continue;
    }
    if (/^(källa saknas|okänd källa|citat saknas|källa behövs)$/i.test(context)) {
      pattern.lastIndex = end;
      continue;
    }

    entries.push({
      text,
      person: pageTitle,
      context: context.slice(0, 210),
      sourceUrl: WIKIQUOTE_PAGE_BASE + encodeURIComponent(pageTitle.replace(/ /g, "_")),
    });
    pattern.lastIndex = end;
  }

  return entries;
}

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (Math.imul(result, 31) + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function gcd(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}

function stableShuffle(quotes: Quote[]) {
  return [...quotes].sort((a, b) => {
    const left = hash(a.person + "|" + a.text);
    const right = hash(b.person + "|" + b.text);
    return left - right || a.person.localeCompare(b.person);
  });
}

async function fetchWikiquoteBatch(titles: string[]): Promise<Quote[]> {
  const url = new URL(WIKIQUOTE_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("rvprop", "content");
  url.searchParams.set("rvslots", "main");
  url.searchParams.set("titles", titles.join("|"));

  const response = await fetch(url, {
    signal: AbortSignal.timeout(18000),
    headers: {
      "User-Agent": "Glenn-News/1.0 (historical quotation panel)",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Svenska Wikiquote svarade med HTTP " + response.status);
  const payload = await response.json() as WikiquoteResponse;
  const quotes: Quote[] = [];

  for (const page of payload.query?.pages ?? []) {
    if (page.missing) continue;
    const wikitext = page.revisions?.[0]?.slots?.main?.content ?? page.revisions?.[0]?.["*"];
    if (!wikitext) continue;
    quotes.push(...extractSourcedQuoteTemplates(wikitext, page.title));
  }

  return quotes;
}

async function buildHistoricalQuotePool(): Promise<Quote[]> {
  const uniqueTitles = [...new Set(HISTORICAL_PAGES)];
  const batches: string[][] = [];
  for (let index = 0; index < uniqueTitles.length; index += 40) {
    batches.push(uniqueTitles.slice(index, index + 40));
  }

  const settled = await Promise.allSettled(batches.map(fetchWikiquoteBatch));
  const candidates: Quote[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") candidates.push(...result.value);
    else console.error("Ett historiskt Wikiquote-batch misslyckades:", result.reason);
  }

  const seen = new Set<string>();
  const unique = candidates.filter(quote => {
    const key = quote.text.toLocaleLowerCase("sv-SE").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Prefer substantial, sourced passages; fall back to shorter sourced entries only
  // when needed to keep the long-term rotation broad.
  const substantial = unique.filter(quote => quote.text.length >= 95 && quote.text.length <= 820);
  const broader = unique.filter(quote => quote.text.length >= 60 && quote.text.length <= 1000);
  const selected = (substantial.length >= 500 ? substantial : broader)
    .slice(0, 1000);

  if (selected.length < 500) {
    console.warn(
      "Det historiska citaturvalet innehåller färre än 500 poster:",
      selected.length,
      "unika källbelagda utdrag hittades."
    );
  } else {
    console.info("Historiskt citaturval laddat:", selected.length, "källbelagda utdrag.");
  }

  return stableShuffle(selected.length > 0 ? selected : FALLBACK_QUOTES);
}

const getCachedHistoricalQuotePool = unstable_cache(
  buildHistoricalQuotePool,
  ["glenn-news-historical-quote-pool-v1"],
  { revalidate: 30 * 24 * 60 * 60, tags: ["glenn-news-historical-quotes"] }
);

function stockholmDayOrdinal() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find(part => part.type === "year")?.value ?? 2000);
  const month = Number(parts.find(part => part.type === "month")?.value ?? 1);
  const day = Number(parts.find(part => part.type === "day")?.value ?? 1);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export async function getQuote(sectionKey: string, index: number): Promise<Quote> {
  let pool: Quote[];
  try {
    pool = await getCachedHistoricalQuotePool();
  } catch (error) {
    console.error("Det historiska citaturvalet kunde inte hämtas:", error);
    pool = FALLBACK_QUOTES;
  }

  if (pool.length === 0) pool = FALLBACK_QUOTES;
  const stepStart = 137;
  let step = stepStart;
  while (gcd(step, pool.length) !== 1) step += 1;

  const day = stockholmDayOrdinal();
  const offset = hash(sectionKey + ":" + index) % pool.length;
  const position = (day * step + offset) % pool.length;
  const quote = pool[position];

  return {
    ...quote,
    poolSize: pool.length,
  };
}

export const quoteSourceLicenseUrl = WIKIQUOTE_LICENCE_URL;
