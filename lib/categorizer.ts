export function detectCategory(
  article: any
) {
  const text = `${article.title} ${article.description ?? ""} ${article.source ?? ""}`.toLowerCase();

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


  // ECONOMY signals precede lifestyle so financial stories from broad RSS
  // feeds cannot leak into Culture, Food & Lifestyle due to words like "mat".
  if (
    /\b(ekonomi|börs(?:en|ras)?|inflation|ica banken|bolån|bostadsrätt|omxs30|nasdaq|dow jones|wall street|ränta|riksbanken|recession|konjunktur|aktier?|fonder?|bitcoin|ethereum|krypto|volvo|swedbank|handelsbanken|nordea|oljepris|elpris|gaspris|styrränta|arbetslöshet|lågkonjunktur|massvarsel|massuppsägning|rekordvinst|omsättning|finanskris|valuta|aktiekurs|börsvärde|marknadsvärde|prishöjning|prisökning|bostadspriser|elräkning|elpriser)\b/i.test(text)
  ) {
    return "ekonomi";
  }

  // KULTUR / MAT / LIVSSTIL

  if (
    text.includes("recension") ||
    text.includes("recenserar") ||
    text.includes("betyg") ||
    text.includes("konsert") ||
    text.includes("spelning") ||
    text.includes("livegig") ||
    text.includes("musik") ||
    text.includes("punk") ||
    text.includes("rock") ||
    text.includes("indie") ||
    text.includes("artist") ||
    text.includes("album") ||
    text.includes("singel") ||
    text.includes("festival") ||
    text.includes("teater") ||
    text.includes("film") ||
    text.includes("bio") ||
    text.includes("serie") ||
    text.includes("bok") ||
    text.includes("författare") ||
    text.includes("kultur") ||
    text.includes("spotify") ||
    text.includes("netflix") ||
    text.includes("avantgardet") ||
    text.includes("melodifestivalen") ||
    text.includes("eurovision") ||
    text.includes("way out west") ||
    text.includes("håkan hellström") ||
    text.includes("laleh") ||
    text.includes("restaurang") ||
    text.includes("krog") ||
    text.includes("recept") ||
    /(?:^|[^\p{L}])mat(?:$|[^\p{L}])/u.test(text) ||
    text.includes("matlagning") ||
    text.includes("matkultur") ||
    text.includes("bakning") ||
    /(?:^|[^\p{L}])vin(?:$|[^\p{L}])/u.test(text) ||
    /(?:^|[^\p{L}])öl(?:$|[^\p{L}])/u.test(text)
  ) {
    return "livsstil";
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
