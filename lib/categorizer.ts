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
    text.includes("johan larsson") ||
    text.includes("hedlund") ||
    text.includes("zeneli") ||
    text.includes("ihler") ||
    text.includes("wikström") ||
    text.includes("holmén") ||
    text.includes("buhari") ||
    text.includes("magnusson") ||
    text.includes("silverholt") ||
    text.includes("yegbe") ||
    text.includes("rapp") ||
    text.includes("thomasen") ||
    text.includes("pettersson") ||
    text.includes("gulsvart") ||
    text.includes("gulsvarta") ||
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
    text.includes("atp") ||
    text.includes("wta") ||
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
    text.includes("rune") ||
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
    text.includes("nasdaq") ||
    text.includes("dow jones") ||
    text.includes("s&p 500") ||
    text.includes("wall street") ||
    text.includes("ränta") ||
    text.includes("riksbanken") ||
    text.includes("ekonomi") ||
    text.includes("företag") ||
    text.includes("arbetslöshet") ||
    text.includes("recession") ||
    text.includes("konjunktur") ||
    text.includes("bnp") ||
    text.includes("kpi") ||
    text.includes("aktie") ||
    text.includes("fond") ||
    text.includes("rapport") ||
    text.includes("bitcoin") ||
    text.includes("ethereum") ||
    text.includes("krypto") ||
    text.includes("volvo") ||
    text.includes("ericsson") ||
    text.includes("swedbank") ||
    text.includes("handelsbanken") ||
    text.includes("seb") ||
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
    text.includes("ukraina") ||
    text.includes("ryssland") ||
    text.includes("usa") ||
    text.includes("kina") ||
    text.includes("taiwan") ||
    text.includes("nato") ||
    text.includes("iran") ||
    text.includes("israel") ||
    text.includes("gaza") ||
    text.includes("hormuz") ||
    text.includes("fn") ||
    text.includes("eu") ||
    text.includes("krig") ||
    text.includes("konflikt") ||
    text.includes("terror") ||
    text.includes("attack") ||
    text.includes("missil") ||
    text.includes("militär") ||
    text.includes("invasion") ||
    text.includes("vapenvila") ||
    text.includes("president") ||
    text.includes("val") ||
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
    text.includes("film") ||
    text.includes("musik") ||
    text.includes("streaming") ||
    text.includes("spotify") ||
    text.includes("konsert") ||
    text.includes("svt") ||
    text.includes("netflix") ||
    text.includes("teater") ||
    text.includes("konst") ||
    text.includes("recension") ||
    text.includes("festival") ||
    text.includes("melodifestivalen") ||
    text.includes("eurovision") ||
    text.includes("idol") ||
    text.includes("way out west") ||
    text.includes("håkan hellström") ||
    text.includes("veronica maggio") ||
    text.includes("kent") ||
    text.includes("darin") ||
    text.includes("miss li") ||
    text.includes("molly sandén") ||
    text.includes("benjamin ingrosso") ||
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
    text.includes("f1") ||
    text.includes("verstappen") ||
    text.includes("hamilton") ||
    text.includes("norris") ||
    text.includes("ferrari") ||
    text.includes("mclaren") ||
    text.includes("hockey") ||
    text.includes("shl") ||
    text.includes("nhl") ||
    text.includes("tre kronor") ||
    text.includes("handboll") ||
    text.includes("golf") ||
    text.includes("pga tour") ||
    text.includes("tour de france") ||
    text.includes("ufc") ||
    text.includes("mma") ||
    text.includes("boxning") ||
    text.includes("simning") ||
    text.includes("padel") ||
    text.includes("innebandy") ||
    text.includes("duplantis") ||
    text.includes("sarah sjöström") ||
    text.includes("frida karlsson") ||
    text.includes("ebba andersson") ||
    text.includes("jonna sundling") ||
    text.includes("sebastian samuelsson") ||
    text.includes("hanna öberg")
  ) {
    return "sport";
  }

  return null;
}
