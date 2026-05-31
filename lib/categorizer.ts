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
    text.includes("borås arena")
  ) {
    return "elfsborg";
  }

  // BORÅS

  if (
    text.includes("borås") ||
    text.includes("öresjö") ||
    text.includes("husarvid") ||
    text.includes("sjuhärad")
  ) {
    return "boras";
  }

  // TENNIS

  if (
    text.includes("tennis") ||
    text.includes("roland garros") ||
    text.includes("wimbledon") ||
    text.includes("atp") ||
    text.includes("wta") ||
    text.includes("sabalenka") ||
    text.includes("gauff") ||
    text.includes("sinner") ||
    text.includes("alcaraz") ||
    text.includes("grand slam") ||
    text.includes("djokovic")
  ) {
    return "tennis";
  }

  // FOTBOLL

  if (
    text.includes("champions league") ||
    text.includes("premier league") ||
    text.includes("allsvenskan") ||
    text.includes("landslaget") ||
    text.includes("fotboll") ||
    text.includes("roma") ||
    text.includes("olof lundh") ||
    text.includes("barcelona") ||
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
    text.includes("ica") ||
    text.includes("bolån") ||
    text.includes("bostadsrätt") ||
    text.includes("bostad") ||
    text.includes("invester") ||
    text.includes("omxs30") ||
    text.includes("ränta") ||
    text.includes("riksbanken") ||
    text.includes("ekonomi") ||
    text.includes("företag")
  ) {
    return "ekonomi";
  }

  // VÄRLDEN

  if (
    text.includes("trump") ||
    text.includes("putin") ||
    text.includes("ukraina") ||
    text.includes("nato") ||
    text.includes("hormuz") ||
    text.includes("fn") ||
    text.includes("eu") ||
    text.includes("kina") ||
    text.includes("iran") ||
    text.includes("israel") ||
    text.includes("gaza")
  ) {
    return "varlden";
  }

  // KULTUR

  if (
    text.includes("film") ||
    text.includes("musik") ||
    text.includes("streaming") ||
    text.includes("spotify") ||
    text.includes("konsert") ||
    text.includes("svt") ||
    text.includes("netflix") ||
    text.includes("terra") ||
    text.includes("konst") ||
    text.includes("recension") ||
    text.includes("festival")
  ) {
    return "livsstil";
  }

  // SPORT

  if (
    text.includes("skidskytte") ||
    text.includes("skidor") ||
    text.includes("friidrott") ||
    text.includes("formel 1")
  ) {
    return "sport";
  }

  return null;
}