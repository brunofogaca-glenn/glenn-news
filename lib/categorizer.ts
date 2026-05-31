```ts
export function detectCategory(article: any) {
  const text = `${article.title ?? ""} ${article.description ?? ""}`.toLowerCase();

  const has = (...terms: string[]) =>
    terms.some((term) => text.includes(term));

  // ELFSBORG
  if (
    has(
      "elfsborg",
      "guliganerna",
      "hamberg",
      "andreasson",
      "holvik",
      "nummer8",
      "isherwood",
      "rohdén",
      "kandolin",
      "borås arena",
      "hiljemark",
      "oscar hiljemark",
      "johan larsson",
      "simon hedlund",
      "arbër zeneli",
      "zeneli",
      "ihler",
      "frederik ihler",
      "wikström",
      "sebastian holmén",
      "holmén",
      "hedlund",
      "buhari",
      "julius magnusson",
      "magnusson",
      "silverholt",
      "yegbe",
      "rapp",
      "thomasen",
      "pettersson",
      "gulsvart",
      "gulsvarta",
      "di gule"
    )
  ) {
    return "elfsborg";
  }

  // BORÅS
  if (
    has(
      "borås",
      "öresjö",
      "husarvid",
      "sjuhärad",
      "norrby",
      "brämhult",
      "sandared",
      "dalsjöfors",
      "fristad",
      "viskafors",
      "sjömarken",
      "trandared",
      "hestra",
      "gånghester",
      "högskolan i borås",
      "ellos",
      "netonnet",
      "cellbes",
      "nelly",
      "care of carl"
    )
  ) {
    return "boras";
  }

  // TENNIS
  if (
    has(
      "tennis",
      "atp",
      "wta",
      "grand slam",
      "roland garros",
      "wimbledon",
      "us open",
      "australian open",
      "djokovic",
      "novak djokovic",
      "sinner",
      "jannik sinner",
      "alcaraz",
      "carlos alcaraz",
      "zverev",
      "medvedev",
      "rublev",
      "ruud",
      "tsitsipas",
      "rune",
      "fritz",
      "shelton",
      "de minaur",
      "sabalenka",
      "gauff"
    )
  ) {
    return "tennis";
  }

  // FOTBOLL
  if (
    has(
      "fotboll",
      "allsvenskan",
      "champions league",
      "premier league",
      "conference league",
      "europa league",
      "landslaget",
      "roma",
      "barcelona",
      "manchester united",
      "bayern munchen",
      "serie a",
      "olof lundh",
      "noa bachner",
      "graham potter"
    )
  ) {
    return "fotboll";
  }

  // EKONOMI
  if (
    has(
      "börsen",
      "inflation",
      "bolån",
      "bostadsrätt",
      "bostad",
      "invester",
      "omxs30",
      "nasdaq",
      "dow jones",
      "s&p 500",
      "wall street",
      "ränta",
      "riksbanken",
      "ekonomi",
      "företag",
      "arbetslöshet",
      "recession",
      "konjunktur",
      "bnp",
      "tillväxt",
      "kpi",
      "konsumentprisindex",
      "ecb",
      "fed",
      "federal reserve",
      "centralbank",
      "aktie",
      "aktier",
      "fond",
      "fondsparande",
      "utdelning",
      "rapport",
      "kvartalsrapport",
      "vinstvarning",
      "bitcoin",
      "ethereum",
      "krypto",
      "kryptovaluta",
      "ica",
      "volvo",
      "volvo cars",
      "ericsson",
      "atlas copco",
      "assa abloy",
      "hexagon",
      "sandvik",
      "skanska",
      "swedbank",
      "handelsbanken",
      "seb",
      "nordea",
      "fastigheter",
      "fastighetsmarknaden",
      "hyresrätt",
      "amortering",
      "oljepris",
      "elpris",
      "gaspris",
      "diesel"
    )
  ) {
    return "ekonomi";
  }

  // VÄRLDEN
  if (
    has(
      "trump",
      "putin",
      "ukraina",
      "ryssland",
      "usa",
      "kina",
      "taiwan",
      "iran",
      "israel",
      "gaza",
      "nato",
      "fn",
      "un",
      "eu",
      "hormuz",
      "zelenskyj",
      "erdogan",
      "xi jinping",
      "kim jong un",
      "modi",
      "krig",
      "konflikt",
      "terror",
      "terrorism",
      "attack",
      "missil",
      "robotattack",
      "drönarattack",
      "militär",
      "invasion",
      "vapenvila",
      "president",
      "val",
      "election",
      "government",
      "diplomati",
      "sanktioner",
      "united nations",
      "security council",
      "jordbävning",
      "earthquake",
      "orkan",
      "hurricane",
      "översvämning",
      "flood",
      "tsunami",
      "vulkan",
      "wildfire",
      "naturkatastrof",
      "pandemi",
      "epidemi",
      "virus"
    )
  ) {
    return "varlden";
  }

  // KULTUR & NÖJE
  if (
    has(
      "film",
      "musik",
      "spotify",
      "streaming",
      "netflix",
      "konsert",
      "festival",
      "recension",
      "teater",
      "konst",
      "indiepop",
      "melodifestivalen",
      "eurovision",
      "så mycket bättre",
      "idol",
      "masked singer",
      "let's dance",
      "guldbaggen",
      "dramaten",
      "allsång på skansen",
      "way out west",
      "sweden rock",
      "håkan hellström",
      "veronica maggio",
      "kent",
      "darin",
      "miss li",
      "molly sandén",
      "benjamin ingrosso",
      "laleh",
      "thåström",
      "biopremiär",
      "dokumentär",
      "seriepremiär",
      "säsongspremiär",
      "bokmässan",
      "författare",
      "roman",
      "boksläpp",
      "skådespelare",
      "artist",
      "musikal"
    )
  ) {
    return "livsstil";
  }

  // SPORT
  if (
    has(
      "skidskytte",
      "skidor",
      "längdskidor",
      "fridrott",
      "formel 1",
      "f1",
      "verstappen",
      "hamilton",
      "norris",
      "ferrari",
      "mclaren",
      "hockey",
      "ishockey",
      "shl",
      "nhl",
      "tre kronor",
      "stanley cup",
      "handboll",
      "handbollslandslaget",
      "golf",
      "pga tour",
      "lpga",
      "ryder cup",
      "cykel",
      "tour de france",
      "giro d'italia",
      "vuelta",
      "alpint",
      "världscupen",
      "slalom",
      "os",
      "olympiska spelen",
      "paralympics",
      "mma",
      "ufc",
      "boxning",
      "simning",
      "bordtennis",
      "padel",
      "innebandy",
      "orientering",
      "duplantis",
      "mondo",
      "sarah sjöström",
      "sjöström",
      "ebba andersson",
      "jonna sundling",
      "frida karlsson",
      "sebastian samuelsson",
      "samuelsson",
      "hanna öberg"
    )
  ) {
    return "sport";
  }

  return null;
}
```
