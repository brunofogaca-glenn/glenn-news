export function detectCategory(
  article: any
) {
  const text =
    `${article.title} ${
      article.description ?? ""
    }`.toLowerCase();

  // ELFSBORG

  if (
    text.includes("elfsborg") ||
    text.includes("guliganerna") ||
    text.includes("hamberg") ||
    text.includes("andreasson") ||
    text.includes("holvik") ||
    text.includes("nummer8") ||
    text.includes("isherwood") ||
    text.includes("rohden") ||
    text.includes("kandolin") ||
    text.includes("borås arena") ||
    text.includes("hiljemark") ||
    text.includes("di gule")
  ) {
    return "elfsborg";
  }

  // BORÅS

  if (
    text.includes("borås") ||
    text.includes("öresjö") ||
    text.includes("husarvid") ||
    text.includes("sjuhärad") ||
    text.includes("norrby") ||
    text.includes("brämhult") ||
    text.includes("sandared") ||
    text.includes("dalsjöfors") ||
    text.includes("fristad") ||
    text.includes("viskafors") ||
    text.includes("sjömarken") ||
    text.includes("trandared") ||
    text.includes("hestra") ||
    text.includes("gånghester") ||
    text.includes("högskolan i borås") ||
    text.includes("ellos") ||
    text.includes("netonnet") ||
    text.includes("cellbes") ||
    text.includes("nelly") ||
    text.includes("care of carl")
  ) {
    return "boras";
  }

  // TENNIS

  if (
    text.includes("tennis") ||
    text.includes("roland garros") ||
    text.includes("wimbledon") ||
    text.includes("us open") ||
    text.includes("australian open") ||
    text.includes("grand slam") ||
    text.includes("sabalenka") ||
    text.includes("gauff") ||
    text.includes("sinner") ||
    text.includes("alcaraz") ||
    text.includes("djokovic") ||
    text.includes("zverev") ||
    text.includes("medvedev") ||
    text.includes("rublev") ||
    text.includes("ruud") ||
    text.includes("tsitsipas") ||
    text.includes("fritz") ||
    text.includes("shelton")
  ) {
    return "tennis";
  }

  // FOTBOLL

  if (
    text.includes("champions league") ||
    text.includes("premier league") ||
    text.includes("conference league") ||
    text.includes("europa league") ||
    text.includes("allsvenskan") ||
    text.includes("landslaget") ||
    text.includes("fotboll") ||
    text.includes("olof lundh") ||
    text.includes("graham potter") ||
    text.includes("noa bachner") ||
    text.includes("bayern munchen") ||
    text.includes("manchester united") ||
    text.includes("serie a")
  ) {
    return "fotboll";
  }

  // EKONOMI

  if (
    text.includes("börsen") ||
    text.includes("inflation") ||
    text.includes("ica banken") ||
    text.includes("bolån") ||
    text.includes("bostadsrätt") ||
    text.includes("omxs30") ||
    text.includes("nasdaq") ||
    text.includes("dow jones") ||
    text.includes("s&p 500") ||
    text.includes("wall street") ||
    text.includes("ränta") ||
    text.includes("riksbanken") ||
    text.includes("recession") ||
    text.includes("konjunktur") ||
    text.includes("aktie") ||
    text.includes("fond") ||
    text.includes("bitcoin") ||
    text.includes("ethereum") ||
    text.includes("krypto") ||
    text.includes("volvo") ||
    text.includes("swedbank") ||
    text.includes("handelsbanken") ||
    text.includes("nordea") ||
    text.includes("oljepris") ||
    text.includes("elpris") ||
    text.includes("gaspris")
  ) {
    return "ekonomi";
  }

  // VÄRLDEN

  if (
    text.includes("trump") ||
    text.includes("putin") ||
    text.includes("nato") ||
    text.includes("gaza") ||
    text.includes("hormuz") ||
    text.includes("terror") ||
    text.includes("missil") ||
    text.includes("militär") ||
    text.includes("invasion") ||
    text.includes("vapenvila") ||
    text.includes("president") ||
    text.includes("jordbävning") ||
    text.includes("earthquake") ||
    text.includes("orkan") ||
    text.includes("hurricane") ||
    text.includes("översvämning") ||
    text.includes("flood") ||
    text.includes("tsunami") ||
    text.includes("vulkan") ||
    text.includes("pandemi") ||
    text.includes("epidemi") ||
    text.includes("virus")
  ) {
    return "varlden";
  }

  // KULTUR

  if (
    text.includes("spotify") ||
    text.includes("konsert") ||
    text.includes("netflix") ||
    text.includes("avantgardet") ||
    text.includes("indiepop") ||
    text.includes("festival") ||
    text.includes("melodifestivalen") ||
    text.includes("eurovision") ||
    text.includes("way out west") ||
    text.includes("håkan hellström") ||
    text.includes("laleh")
  ) {
    return "livsstil";
  }

  // SPORT

  if (
    text.includes("skidskytte") ||
    text.includes("skidor") ||
    text.includes("längdskidor") ||
    text.includes("friidrott") ||
    text.includes("formel 1") ||
    text.includes("tour de france")
  ) {
    return "sport";
  }

  return null;
}
