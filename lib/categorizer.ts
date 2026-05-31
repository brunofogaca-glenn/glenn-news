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
  text.includes("rohdén") ||
  text.includes("kandolin") ||
  text.includes("borås arena") ||

  text.includes("hiljemark") ||
  text.includes("oscar hiljemark") ||
  text.includes("johan larsson") ||
  text.includes("simon hedlund") ||
  text.includes("arbër zeneli") ||
  text.includes("zeneli") ||
  text.includes("ihler") ||
  text.includes("frederik ihler") ||
  text.includes("wikström") ||
  text.includes("sebastian holmén") ||
  text.includes("holmén") ||
  text.includes("hedlund") ||
  text.includes("buhari") ||
  text.includes("julius magnusson") ||
  text.includes("magnusson") ||
  text.includes("silverholt") ||
  text.includes("yegbe") ||
  text.includes("rapp") ||
  text.includes("thomasen") ||
  text.includes("pettersson") ||
  text.includes("gulsvart") ||
  text.includes("di gule") ||
  text.includes("ife") ||
  text.includes("gulsvarta") ||
  ) {
    return "elfsborg";
  }

  // BORÅS

  if (
    text.includes("borås") ||
    text.includes("öresjö") ||
    text.includes("husarvid") ||
      text.includes("norrby") ||
      text.includes("ellos") ||
  text.includes("netonnet") ||
  text.includes("cellbes") ||
  text.includes("nelly") ||
  text.includes("care of carl") ||
  text.includes("brämhult") ||
  text.includes("sandared") ||
  text.includes("dalsjöfors") ||
  text.includes("fristad") ||
  text.includes("viskafors") ||
  text.includes("högskolan i borås") ||
  text.includes("sjömarken") ||
  text.includes("trandared") ||
  text.includes("hestra") ||
  text.includes("gånghester") ||
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
      text.includes("sinner") ||
  text.includes("jannik sinner") ||
  text.includes("alcaraz") ||
  text.includes("carlos alcaraz") ||
  text.includes("djokovic") ||
  text.includes("novak djokovic") ||
  text.includes("zverev") ||
  text.includes("medvedev") ||
  text.includes("rublev") ||
  text.includes("ruud") ||
  text.includes("tsitsipas") ||
  text.includes("rune") ||
  text.includes("fritz") ||
  text.includes("shelton") ||
  text.includes("de minaur") ||
      text.includes("roland garros") ||
  text.includes("wimbledon") ||
  text.includes("us open") ||
  text.includes("australian open") ||
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
      text.includes("nasdaq") ||
      text.includes("arbetslöshet") ||
  text.includes("recession") ||
     text.includes("centralbank") ||
  text.includes("ecb") ||
  text.includes("federal reserve") ||
  text.includes("fed") ||

  text.includes("aktie") ||
  text.includes("aktier") ||
  text.includes("fondsparande") ||
  text.includes("fond") ||
  text.includes("utdelning") ||
  text.includes("kvartalsrapport") ||
  text.includes("vinstvarning") ||
  text.includes("rapport") ||

  text.includes("bitcoin") ||
  text.includes("ethereum") ||
  text.includes("krypto") ||
  text.includes("kryptovaluta") ||

  text.includes("volvo") ||
  text.includes("volvo cars") ||
  text.includes("ericsson") ||
  text.includes("atlas copco") ||
  text.includes("assa abloy") ||
  text.includes("hexagon") ||
  text.includes("sandvik") ||
  text.includes("skanska") ||
  text.includes("swedbank") ||
  text.includes("handelsbanken") ||
  text.includes("seb") ||
  text.includes("nordea") ||

  text.includes("fastigheter") ||
  text.includes("fastighetsmarknaden") ||
  text.includes("hyresrätt") ||
  text.includes("amortering") ||

  text.includes("oljepris") ||
  text.includes("elpris") ||
  text.includes("gaspris") ||
  text.includes("diesel") ||
  text.includes("konjunktur") ||
  text.includes("bnp") ||
  text.includes("tillväxt") ||
  text.includes("konsumentprisindex") ||
  text.includes("kpi") ||
  text.includes("dow jones") ||
  text.includes("s&p 500") ||
  text.includes("wall street") ||
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
  text.includes("gaza") ||

  text.includes("ryssland") ||
  text.includes("usa") ||
  text.includes("taiwan") ||
  text.includes("zelenskyj") ||
  text.includes("erdogan") ||
  text.includes("xi jinping") ||
  text.includes("kim jong un") ||
  text.includes("modi") ||

  text.includes("krig") ||
  text.includes("konflikt") ||
  text.includes("terror") ||
  text.includes("terrorism") ||
  text.includes("attack") ||
  text.includes("missil") ||
  text.includes("robotattack") ||
  text.includes("drönarattack") ||
  text.includes("militär") ||
  text.includes("invasion") ||
  text.includes("vapenvila") ||
      text.includes("president") ||
  text.includes("val") ||
  text.includes("election") ||
  text.includes("government") ||
  text.includes("diplomati") ||
  text.includes("sanktioner") ||

  text.includes("united nations") ||
  text.includes("security council") ||
  text.includes("un") ||

  text.includes("jordbävning") ||
  text.includes("earthquake") ||
  text.includes("orkan") ||
  text.includes("hurricane") ||
  text.includes("översvämning") ||
  text.includes("flood") ||
  text.includes("tsunami") ||
  text.includes("vulkan") ||
  text.includes("wildfire") ||
  text.includes("naturkatastrof") ||

  text.includes("pandemi") ||
  text.includes("epidemi") ||
  text.includes("virus") ||
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
     text.includes("melodifestivalen") ||
  text.includes("eurovision") ||
  text.includes("så mycket bättre") ||
  text.includes("idol") ||
  text.includes("masked singer") ||
  text.includes("let's dance") ||

  text.includes("guldbaggen") ||
  text.includes("dramaten") ||
  text.includes("allsång på skansen") ||
  text.includes("way out west") ||
  text.includes("sweden rock") ||

  text.includes("håkan hellström") ||
  text.includes("veronica maggio") ||
  text.includes("kent") ||
  text.includes("darin") ||
  text.includes("miss li") ||
  text.includes("molly sandén") ||
  text.includes("benjamin ingrosso") ||
  text.includes("laleh") ||
  text.includes("thåström") ||

  text.includes("biopremiär") ||
  text.includes("dokumentär") ||
  text.includes("seriepremiär") ||
  text.includes("säsongspremiär") ||

  text.includes("bokmässan") ||
  text.includes("författare") ||
  text.includes("roman") ||
  text.includes("boksläpp") ||

  text.includes("skådespelare") ||
  text.includes("artist") ||
  text.includes("musikal") ||
    text.includes("konsert") ||
    text.includes("netflix") ||
    text.includes("terra") ||
    text.includes("indiepop") ||
    text.includes("recension") ||
    text.includes("festival")
  ) {
    return "livsstil";
  }

  // SPORT

  if (
  text.includes("skidskytte") ||
  text.includes("skidor") ||
  text.includes("längdskidor") ||
  text.includes("fridrott") ||
  text.includes("formel 1") ||

  text.includes("f1") ||
  text.includes("verstappen") ||
  text.includes("hamilton") ||
  text.includes("norris") ||
  text.includes("ferrari") ||
  text.includes("mclaren") ||

  text.includes("ishockey") ||
  text.includes("hockey") ||
  text.includes("shl") ||
  text.includes("nhl") ||
  text.includes("tre kronor") ||
  text.includes("stanley cup") ||

  text.includes("handboll") ||
  text.includes("handbollslandslaget") ||

  text.includes("golf") ||
  text.includes("pga tour") ||
  text.includes("lpga") ||
  text.includes("ryder cup") ||

  text.includes("cykel") ||
  text.includes("tour de france") ||
  text.includes("giro d'italia") ||
  text.includes("vuelta") ||

  text.includes("alpint") ||
  text.includes("världscupen") ||
  text.includes("slalom") ||

  text.includes("os") ||
  text.includes("olympiska spelen") ||
  text.includes("paralympics") ||

  text.includes("mma") ||
  text.includes("ufc") ||
  text.includes("boxning") ||

  text.includes("simning") ||
  text.includes("bordtennis") ||
  text.includes("padel") ||
  text.includes("innebandy") ||
  text.includes("orientering") ||

  text.includes("duplantis") ||
  text.includes("mondo") ||
  text.includes("sarah sjöström") ||
  text.includes("sjöström") ||
  text.includes("ebba andersson") ||
  text.includes("jonna sundling") ||
  text.includes("frida karlsson") ||
  text.includes("samuelsson") ||
  text.includes("sebastian samuelsson") ||
  text.includes("hanna öberg") ||
  ) {
    return "sport";
  }

  return null;
}
