export type Quote = {
  text: string;
  person: string;
  context?: string;
};

const QUOTES: Quote[] = [
  {
    text: "Jag är en demokratisk socialist med stolthet och glädje.",
    person: "Olof Palme",
    context: "1982",
  },
  {
    text: "För det handlar om solidaritet och omtanke människor emellan.",
    person: "Olof Palme",
    context: "1982",
  },
  {
    text: "Frihet är alltid och uteslutande frihet för den som tänker annorlunda.",
    person: "Rosa Luxemburg",
    context: "Den ryska revolutionen",
  },
  {
    text: "Filosoferna har bara tolkat världen på olika sätt. Det gäller att förändra den.",
    person: "Karl Marx",
    context: "Teser om Feuerbach",
  },
  {
    text: "Det mest oförlåtliga brottet i samhället är självständigt tänkande.",
    person: "Emma Goldman",
    context: "Anarchism and Other Essays",
  },
  {
    text: "Vår uppgift är att göra arbetaren medveten om varför hans klass kämpar.",
    person: "Hjalmar Branting",
    context: "1908",
  },
  {
    text: "Kapitalismen känner ingen annan gud än penningen och har inget annat fosterland än det, där rikedom står att vinna.",
    person: "Hjalmar Branting",
    context: "1901",
  },
  {
    text: "Vi behöver stöd av ett starkt och slagkraftigt samhälle för att värna vår trygghet och vidga vår frihet.",
    person: "Tage Erlander",
    context: "1962",
  },
  {
    text: "Extraordinära saker uppnås av vanliga människor.",
    person: "Graham Potter",
    context: "2018",
  },
  {
    text: "Jobbet är inte klart ännu.",
    person: "Graham Potter",
    context: "2016",
  },
  {
    text: "Jag lyssnar inte på rykten utan gör bara mitt jobb så bra som möjligt.",
    person: "Graham Potter",
    context: "2018",
  },
  {
    text: "Som ledare är du ledare för en grupp bara om människor faktiskt vill följa dig.",
    person: "Michael Carrick",
    context: "Manchester United",
  },
];

function dateSeed() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find(part => part.type === "year")?.value ?? 0);
  const month = Number(parts.find(part => part.type === "month")?.value ?? 0);
  const day = Number(parts.find(part => part.type === "day")?.value ?? 0);

  return year * 372 + month * 31 + day;
}

function hash(value: string) {
  let result = 0;

  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }

  return result;
}

export function getQuote(sectionKey: string, index: number): Quote {
  const position =
    (dateSeed() + hash(sectionKey) + index * 17) % QUOTES.length;

  return QUOTES[position];
}
