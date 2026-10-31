# Glenn News — produktkrav och agentkontrakt

**Status för denna sammanställning:** uppdaterad mot produktionskod och den aktuella datakvalitetskompletteringen den 31 oktober 2026.  
**Syfte:** vara den obligatoriska, gemensamma startpunkten för alla framtida agenter och kodändringar i Glenn News.

> **Regel för alla framtida agenter:** Läs detta dokument först vid varje uppgift. Identifiera berörda krav-ID:n och deras status innan du ändrar kod. Följ sedan den relevanta detaljdokumentationen och inspektera den faktiska implementationen och testerna. Uppdatera detta dokument när krav, produktbeteende, status, datakontrakt eller viktiga tekniska invariants ändras.

Det här dokumentet sammanfattar produktkraven. Det ersätter inte de fördjupade källdokumenten som anges i [dokumentkartan](#1-dokumentkarta-och-beslutsordning).

## 1. Dokumentkarta och beslutsordning

Läs alltid denna kravspecifikation först. Läs därefter bara de detaljerade dokument och moduler som berör uppgiften.

| Källa | Vad den ansvarar för |
| --- | --- |
| **[Produktkrav — detta dokument](product-requirements.md)** | Samlade krav-ID:n, produktavsikt, aktuell status, kända avvikelser och vad ändringar måste bevara. |
| [Agilt förbättringsarbete](improvement-process.md) | Arbetsflöde för användarrapporterade buggar, prioritering, små ändringar, verifiering och nästa fokus. Samlingsärende #52 håller den levande statusen. |
| [UI- och funktionsguide](ui-feature-guide.md) | Synliga sidor, paneler, navigation, knappar, tomma lägen, felmeddelanden och interaktioner. |
| [Arkitektur](architecture.md) | Modulkarta, dataflöden, lagring, prestandakontrakt och hur man säkert ändrar systemet. |
| [Data-refresh-inventering](data-refresh-inventory.md) | Aktiva datakällor, cachetider, scheman, lokala tidsgränser, autentisering och reservdata. |
| [Agentregler](../AGENTS.md) | Arbetsflöde, tester, pull requests, releasehygien och produktionsinvariants. |
| [Rankingtester](../tests/ranker-regression.test.cjs) | Redaktionellt urval, personalisering, läsvärde, dubbletter, Veckofokus och publiceringskontrakt. |
| [Refresh-tester](../tests/data-refresh-regression.test.cjs) | Scheman, datakällor, OIDC, källhygien, cache och uppdateringsbeteende. |
| [Diagnostiktester](../tests/diagnostic-log-regression.test.cjs) | Loggning, maskering, läshistorik och cachekontrakt. |

### Om dokumentation, kod och tester skiljer sig åt

1. Följ uttryckliga instruktioner från användaren i den aktuella uppgiften.
2. Använd detta dokument för den avsedda produktregeln och de kända avvikelserna.
3. Inspektera faktisk kod för att fastställa vad som är implementerat i nuläget. En kommentar eller dokumentation bevisar inte i sig att beteendet fungerar.
4. Använd regressionstester för att förstå vilka invariants som skyddas. Ett grönt test betyder inte att alla produktkrav är heltäckande testade.
5. Om produktavsikt och implementation inte stämmer: ändra inte tyst den ena för att få den att se ut som den andra. Registrera avvikelsen i avsnitt 14, uppdatera statusen och lös den inom den aktuella uppgiftens omfattning. Fråga användaren bara när ett materiellt produktbeslut faktiskt saknar stöd.

### Statusetiketter

- **Implementerat + testskyddat** — koden implementerar beteendet och ett regressionstest skyddar en relevant del av kontraktet.
- **Implementerat** — beteendet finns i koden, men testskyddet är indirekt eller ofullständigt.
- **Produktavsikt / ej kodregel** — det är ett mål eller användningsmönster, inte ett hårt krav som aktuell kod upprätthåller.
- **Behöver synkas** — det finns en känd motsägelse eller oklarhet som inte ska döljas.

Statusen avser senast granskad kod den 29 oktober 2026; den är inte ett påstående om att varje extern datakälla eller den första nattliga körningen efter utrullning redan har verifierats.

## 2. Produktdefinition och designprinciper

Glenn News är en personlig, svenskspråkig, AI-redigerad morgontidning med ett begränsat urval av läsvärda artiklar och kompletterande faktapaneler. Lärdomar från registrerad läsning ska påverka framtida urval, medan viktig journalistik fortsatt ska prioriteras även utanför personliga intressen.

Övergripande principer:

- **Kvalitet framför volym.** Välj hellre ett mindre antal artiklar som motiverar lästiden än så många nyhetsnotiser som möjligt.
- **Nyhetsvärde framför filterbubbla.** Personalisering är en begränsad relevanssignal, inte en absolut sanning.
- **Färskhet och tydlighet.** Visa rätt datum, generationstid och reservstatus. Presentera aldrig en gammal utgåva som dagens nyhetsurval.
- **Tålighet mot fel.** Ett fel i en valfri panel ska inte ta ned hela tidningen. Behåll senast kända giltiga data när det är säkert och möjligt.
- **Låg och förutsägbar driftkostnad.** Undvik upprepade Blob-skrivningar, externa anrop och AI-anrop för varje klick eller sidrendering.
- **Spårbarhet.** För synliga beteenden och viktiga dataflöden ska det gå att hitta ägande kod, relevant regressionstest och dokumentation.
- **Ärlighet om data.** Skilj på aktuell, inaktuell, partiell, tom och felaktig data. Gissa inte saknade fakta.

## 3. Kravregister

### A. Navigering och gränssnitt

| ID | Krav | Status | Primär implementation / test |
| --- | --- | --- | --- |
| UI-01 | Produkten har fyra huvudsidor: Tidning `/`, Veckofokus `/veckofokus`, Profil `/profil` och Källor `/health`. | Implementerat | `app/page.tsx`, `app/veckofokus/page.tsx`, `app/profil/page.tsx`, `app/health/page.tsx` |
| UI-02 | Gränssnittet ska vara svenskt och fungera på mobil, surfplatta och dator. | Implementerat | `app/layout.tsx`, `app/globals.css`, `app/components/MobileNav.tsx` |
| UI-03 | Mobilnavigeringen ska ha de fyra destinationerna, markera aktuell sida och inte skymma sidinnehåll. | Implementerat | `app/components/MobileNav.tsx`, [UI-guiden](ui-feature-guide.md) |
| UI-04 | Asynkrona kontroller ska visa begripliga fel-/statuslägen, korrekta disabled-lägen och tillgängliga etiketter/roller. Hemliga värden får aldrig exponeras i felmeddelanden. | Implementerat; generell testning | [UI-guiden](ui-feature-guide.md), berörda sid- och komponentfiler |
| UI-05 | Alla ändringar av routes, navigation, paneler, knappar, responsivitet eller tomma/felaktiga lägen ska dokumenteras i UI-guiden. | Agentregel | [AGENTS.md](../AGENTS.md), [UI-guiden](ui-feature-guide.md) |

### B. Morgonutgåva och publicering

| ID | Krav | Status | Primär implementation / test |
| --- | --- | --- | --- |
| ED-01 | Publicera en daterad morgonutgåva med sju sektioner: Elfsborg, Lokalt, Sverige, Världen, Ekonomi, Sport och Kultur, Mat & Livsstil. | Implementerat + testskyddat | `lib/dailyEdition.ts`, ranker-regressionstest |
| ED-02 | Datum och kalenderveckoberäkningar ska använda `Europe/Stockholm`, även vid sommar-/vintertid. | Implementerat + testskyddat | `lib/dailyEdition.ts`, `lib/weekFocus.ts`, refresh-tester |
| ED-03 | Redaktionella RSS-/webbkällor och livekontroller av deras hälsa får inte hämtas före 06.00 svensk tid. Samma tidsgräns gäller sidvägar som annars kunde orsaka dolda hämtningar. | Implementerat + testskyddat | `lib/updateSchedule.ts`, `lib/rss.ts`, `lib/dailyEdition.ts`, refresh-tester |
| ED-04 | Utgåvan valideras före sparning och återigen vid läsning. Datum, sektioner, rubriker, artikelstruktur, HTTP(S)-länkar och innehållskrav kontrolleras. En utgåva utan artiklar eller utan valda läsbara berättelser ska avvisas. | Implementerat + testskyddat | `lib/dailyEdition.ts`, refresh-tester |
| ED-05 | Dubbletter ska filtreras med normaliserade länkar och rubriker. Dagens urval ska undvika artiklar från de föregående sju dagsutgåvorna, inte bara gårdagen. | Implementerat; skyddet är delvis testat | `lib/dailyEdition.ts`, `lib/editorV2.ts`, `lib/rss.ts` |
| ED-06 | Spara högst en giltig utgåva per datum i normal drift. Återförsök ska återanvända en redan publicerad giltig utgåva när publiceringsreglerna säger att den är tillräckligt färsk. | Implementerat; tidsdetalj behöver synkas | `lib/dailyEdition.ts`, `app/api/cron/refresh-news/route.ts`, avsnitt 14 |
| ED-07 | Om dagens utgåva misslyckas får en tidigare utgåva bara visas med tydlig etikett `Reservedition · inte dagens nyhetsurval` och sitt datum. Om ingen giltig reserv finns ska ett tydligt otillgängligt läge visas med en återförsöksväg. | Implementerat + testskyddat | `lib/dailyEdition.ts`, `app/page.tsx`, refresh-tester |
| ED-08 | Morgonutgåvan ska vara avsedd att vara klar omkring 06.30 svensk tid. Vercel Pro Cron kan ha variation i faktisk start-/leveranstid och garanterar inte att en viss minut alltid nås. | Behöver synkas mellan publiceringsmål och schemaläggningsbeteende | `vercel.json`, `app/api/cron/refresh-news/route.ts`, `lib/dailyEdition.ts`, avsnitt 14 |
| ED-09 | En manuell källuppdatering får inte skriva om dagens sparade morgonutgåva. Återskapande av saknad utgåva är en separat, uttrycklig återförsöksfunktion. | Implementerat + testskyddat | `app/actions.ts`, `app/components/RetryMorningEditionButton.tsx`, refresh-tester |
| ED-10 | Bildberikning ska vara begränsad i parallellism och tid, och får inte stoppa hela publiceringen om en bildhämtning blir långsam eller misslyckas. | Implementerat | `lib/editorV2.ts` |

### C. Redaktionell kvalitet, AI och personalisering

| ID | Krav | Status | Primär implementation / test |
| --- | --- | --- | --- |
| EDQ-01 | Prioritera krönikor, analys, intervju, reportage och kommentar framför vanliga notiser när nyhetsvärdet i övrigt är jämförbart. | Implementerat + testskyddat | `lib/ranker.ts`, `lib/editorV2.ts`, ranker-tester |
| EDQ-02 | Nyhetsvärde, aktualitet, bredd i bevakningen och samhällsbetydelse ska vägas in utöver personlig relevans. Viktiga nyheter ska kunna väljas även utan klickhistorik. | Implementerat + testskyddat | `lib/ranker.ts`, ranker-tester |
| EDQ-03 | Den kombinerade personaliseringspoängen ska vara begränsad till 55 i rankern, så att personliga signaler inte kan växa obegränsat. | Implementerat + testskyddat | `lib/ranker.ts`, ranker-tester |
| EDQ-04 | AI-redaktören ska skriva naturlig, rak svenska. Lägesbilden ska normalt vara 4–5 meningar; varje vald artikel ska få kort sammanfattning och en motivering till varför den är läsvärd. | Implementerat; direkt testning är begränsad | `lib/editorV2.ts` |
| EDQ-05 | AI:n får endast göra faktapåståenden som stöds av artikelunderlaget. Tvetydigt underlag ska hanteras försiktigt, och instruktioner som förekommer i artiklar ska behandlas som källinnehåll, inte systeminstruktioner. | Promptkrav implementerat; faktisk faktatrohet kan inte garanteras av prompten ensam | `lib/editorV2.ts` |
| EDQ-06 | Om AI:n misslyckas, returnerar ogiltigt innehåll eller väljer för få giltiga artiklar ska rankat reservurval användas. AI-val ska valideras mot faktiska kandidater och dubbletter ska stoppas. | Implementerat | `lib/editorV2.ts` |
| EDQ-07 | Elfsborg ska ha en särskild huvudartikel och en bredare artikelpool. Material ska inte filtreras bort bara för att det finns många artiklar; poolen kan bidra till full täckning och Veckofokus. | Implementerat | `lib/editorV2.ts`, `lib/dailyEdition.ts` |
| EDQ-08 | Fotbollsurval ska följa aktuella snackisar och relevans, inte fasta kvoter för specifika ligor. | Implementerat + testskyddat | `lib/editorV2.ts`, ranker-/refresh-tester |
| EDQ-09 | Sportsektionen väljer upp till åtta fotbollsartiklar och upp till två artiklar från övrig sport; sektionen har högst tio valda artiklar. Om underlaget för övrig sport är tunt kan platser fyllas med annan relevant fotboll. | Implementerat; testskydd delvis | `lib/editorV2.ts`, ranker-/refresh-tester |
| EDQ-10 | Trav och hästkapplöpning ska normalt inte väljas till övrig sport. Undvik två artiklar om samma sport när jämförbart relevant bredd finns och välj normalt högst en tennisartikel i det angivna läget. | AI-redaktörens instruktion; beteendet är inte deterministiskt garanterat | `lib/editorV2.ts` |
| EDQ-11 | Rankern ska ge poäng som går att jämföra numeriskt, hantera bred källtäckning utan obegränsad multiplikatoreffekt och bevara indataartiklar i själva rankeringssteget. | Implementerat + testskyddat | `lib/ranker.ts`, ranker-tester |
| EDQ-12 | Använd en gemensam modellkonfiguration i stället för separata, hårdkodade modellnamn per AI-funktion. | Implementerat | `lib/aiConfig.ts` |

### D. Läshistorik och läsarprofil

| ID | Krav | Status | Primär implementation / test |
| --- | --- | --- | --- |
| READ-01 | Artikelklick i tidningen och Veckofokus ska köas i webbläsarens `sessionStorage`; en klickhändelse uppdaterar en lokal räknare men är inte bevis på att serverprofilen redan är sparad. | Implementerat | `app/components/TrackableLink.tsx`, `WeeklyStoryLink.tsx`, `readerQueue.ts` |
| READ-02 | Användaren ska uttryckligen kunna spara läsningen efteråt. Varje batch får innehålla högst 50 händelser. En större kö skickas över flera sparningar. | Implementerat + testskyddat | `SaveReadingHistoryButton.tsx`, `app/api/events/batch/route.ts`, refresh-/diagnostiktester |
| READ-03 | Misslyckad batch ska kunna återförsökas utan att osparade klick försvinner. Validering ska avvisa felaktiga batchar, URL:er, tidsstämplar eller orimligt långa fält. | Implementerat | `readerQueue.ts`, `app/api/events/batch/route.ts` |
| READ-04 | Händelser ska först lagras som batchar och konsolideras av Vercel Cron till en gemensam historik-ledger. Samma händelse eller batch får inte dubbelräknas vid återförsök. | Implementerat + testskyddat | `lib/readerProfile.ts`, `app/api/cron/process-reader-history/route.ts`, diagnostik-/refresh-tester |
| READ-05 | Klick ska inte utlösa en Blob-skrivning eller individuell AI-klassificering per artikel. Profilaggregering och eventuell historikunderhåll sker i Vercel Cron-bakgrundsjobbet. | Implementerat + testskyddat | `lib/readerProfile.ts`, batch-API, Vercel Cron-route |
| READ-06 | Om historik eller profil inte kan läsas på ett tillförlitligt sätt får giltiga tidigare data inte ersättas med tom historik. Behåll ledger/snapshot och använd säker reservväg där sådan finns. | Implementerat; regressionstestning delvis | `lib/readerProfile.ts`, `AGENTS.md`, diagnostik-/refresh-tester |
| READ-07 | Profilen ska bygga på kategori, artikeltyp, källa, ämne samt semantiska ämnen, taggar, personer/lag/organisationer och geografi när klassificerade signaler finns. | Implementerat | `lib/readerProfile.ts`, `app/profil/page.tsx` |
| READ-08 | Profilvyn ska visa läsaktivitet och intressetendenser, inklusive 7-/30-dagarsaktivitet, läsrytm, favoritkällor och upp till 20 senaste registrerade aktiviteter. Svaga signaler ska inte presenteras som säkra preferenser. | Implementerat | `app/profil/page.tsx`, UI-guiden |
| READ-09 | Vanlig läsning ska använda en kompakt profil-snapshot/cache i stället för att vid varje render ladda ned och aggregera hela historiken. | Implementerat | `lib/readerProfile.ts` |
| READ-10 | Historiken ska vara gemensam mellan enheter, men endast läsning som registreras genom Glenn News räknas. Läsning som görs direkt på externa sajter blir inte automatiskt registrerad. | Implementerat, begränsning dokumenterad | `readerQueue.ts`, [UI-guiden](ui-feature-guide.md) |
| READ-11 | Den avsedda normala läsperioden är ungefär 07.00–11.00, men läsregistrering ska inte försvinna eller nekas utanför detta tidsintervall. | Produktavsikt / ej kodregel | Ingen tidsgräns ska införas utan uttryckligt produktbeslut |

### E. Veckofokus

| ID | Krav | Status | Primär implementation / test |
| --- | --- | --- | --- |
| WF-01 | Veckofokus är en helgprodukt: full sida på lördag och söndag, med lördagens datum som gemensam utgåvenyckel. | Implementerat + testskyddat | `app/veckofokus/page.tsx`, `lib/weekFocusCache.ts`, diagnostiktester |
| WF-02 | Urvalet ska bygga på utgåvor och registrerad läshistorik från aktuell kalendervecka, måndag–söndag i svensk tidszon. | Implementerat + testskyddat | `lib/weekFocus.ts`, ranker-tester |
| WF-03 | Redan lästa artiklar och dubbletter ska exkluderas; både valda historier och den bredare artikelpoolen i sparade utgåvor kan bidra med kandidater. | Implementerat + testskyddat | `lib/weekFocusCandidates.ts`, ranker-tester |
| WF-04 | Fördjupning ska prioriteras efter innehållstyp, längd och läsvärde. Korta byrånotiser, direktrapporter och nästan identiska rubriker ska missgynnas eller tas bort. | Implementerat + testskyddat | `lib/weekFocusQuality.ts`, ranker-tester |
| WF-05 | Utgåvan ska ha högst tio berättelser; undvik dubbletter av länk och fokusämne. AI-val ska stödjas av verkliga kandidater och, när historik finns, faktiska läsintressen. | Implementerat | `lib/weekFocus.ts` |
| WF-06 | Personaliseringens status ska vara ärlig. Om den personliga ämnesbilden inte är tillräcklig eller AI-generering misslyckas ska en tydligt beskriven reservsortering användas. | Implementerat | `lib/weekFocus.ts`, UI-guiden |
| WF-07 | När inga olästa fördjupningar finns ska sidan visa `Du är ikapp` i stället för att antyda att fler olästa artiklar finns. | Implementerat | `app/veckofokus/page.tsx` |
| WF-08 | Håll en fixerad, cachad helgutgåva; använd persistent cache, validering och sammanslagning av samtidiga genereringsanrop. Generera inte en ny utgåva per sidbesök. | Implementerat + testskyddat | `lib/weekFocusCache.ts`, diagnostik-/ranker-tester |

### F. Startsida och kompletterande paneler

| ID | Krav | Status | Primär implementation |
| --- | --- | --- | --- |
| HOME-01 | Visa masthead, svensk lokal datumkontext, namnsdag och historisk händelse när data finns, generationstid och artikelantal. | Implementerat | `app/page.tsx`, `lib/dailyHeader.ts` |
| HOME-02 | Visa ett särskilt Elfsborgsblock och övriga utvalda artiklar med rubrik, källa/typ, sammanfattning och bild när tillgänglig. | Implementerat | `app/page.tsx`, `lib/editorV2.ts` |
| HOME-03 | Visa redaktionell lägesbild (`Nyhetsläget`) samt länkar och läsregistrering på artiklar. | Implementerat | `app/page.tsx`, artikelkomponenter |
| HOME-04 | Visa tvådagars väderprognos för Borås med förhållanden, min/max, nederbörd och vind när prognosdata finns. | Implementerat | `lib/weather.ts`, `lib/supplementalCache.ts` |
| HOME-05 | Visa lokala Boråshändelser och kommunmöten, med intressebaserad rangordning och synlig reservkällestatus. | Implementerat | `lib/dailySnapshots.ts`, Borås-eventmoduler |
| HOME-06 | Visa Riksdagens dagordning/nyheter samt världslägesindikatorer, centralbanksräntor och BNP med separata fel-/tomlägen. | Implementerat | `lib/dailySnapshots.ts` |
| HOME-07 | Visa senaste DN-filmrecensioner och DN-skivrecensioner. Moviezine ska inte återinföras som aktiv källa utan uttryckligt beslut. | Implementerat + testskyddat | `lib/dailySnapshots.ts`, refresh-tester |
| HOME-08 | Visa gårdagens avslutade sportmatcher, dagens utvalda matcher, utvald ligatabell och tre främsta målskyttar när datakällorna är tillgängliga. Visa snapshotens hämtningstid. | Implementerat | `lib/sportDay.ts`, `SportDayPanel.tsx` |
| HOME-09 | Visa föregående avslutade handelssessions värden/förändringar för Stockholm, DAX, S&P 500 och Nasdaq. Visa faktisk handelsdag och snapshotens hämtningstid; presentera inte stängningsdata som dagens rörelse. | Implementerat | `lib/marketDay.ts`, `MarketDayPanel.tsx` |
| HOME-10 | Fel i valfria paneler ska inte blockera morgonutgåvan. Varje källa ska använda befintlig cache-/snapshot-/reservväg och panelen ska visa partiellt fel när relevant. | Implementerat; delvis testat | `lib/dailySnapshots.ts`, `lib/supplementalCache.ts`, source-specifika cachemoduler |
| HOME-11 | `Uppdatera källor` får inte regenerera dagens sparade morgonutgåva. I aktuell implementation uppdaterar den kompletterande paneldata inom sitt manuella tidsfönster. | Implementerat; UI-text behöver synkas | `app/actions.ts`, avsnitt 14 |

### G. Källstatus och diagnostik

| ID | Krav | Status | Primär implementation / test |
| --- | --- | --- | --- |
| OPS-01 | Källstatus ska summera hälsolägen och visa källa, URL, kategori, svarstid, antal artiklar senaste 24 timmarna och ålder på senaste daterade artikel. | Implementerat | `app/health/page.tsx`, `lib/feedHealth.ts` |
| OPS-02 | En källa är stale när senaste daterade artikel är minst 72 timmar gammal. Svarstid ≥2 500 ms ska markeras långsam men inte automatiskt omklassificera en frisk källa som trasig. | Implementerat + testskyddat | `lib/feedHealthMetrics.ts`, ranker-regressionstest |
| OPS-03 | Visa sparad status för morgonhämtning och nattlig kompletteringskörning utan att själva statusvisningen startar nya leverantörsanrop. | Implementerat + testskyddat | `lib/articleRefreshStatus.ts`, `lib/supplementalRefreshRun.ts`, `app/health/page.tsx` |
| OPS-04 | När diagnostikhistorik är tillgänglig ska vyn kunna filtrera 24 timmar/sju dagar och fel/varningar, tillåta omladdning och kopiering samt visa begriplig status. När historiken är avstängd ska UI förklara detta och inte visa tom lista som bevis på felfri drift. Högst 80 poster visas. | Implementerat + regressionstest | `app/components/HealthLogPanel.tsx`, `app/health/page.tsx`, diagnostiktester |
| OPS-05 | Loggar ska maskera vanliga hemligheter/tokens och URL-frågeparametrar, begränsa kontextfält och deduplicera upprepade fel. Persistenta Blob-skrivningar för varje diagnostikhändelse ska undvikas. | Implementerat + testskyddat | `lib/diagnosticLog.ts`, diagnostiktester |
| OPS-06 | Kompletterande faktapaneler, läshistorik och webbläsarskrapningar schemaläggs med Vercel Cron före 06.00 svensk tid. Borås.com och Fotbollskanalen körs i en isolerad Vercel Sandbox; GitHub Actions behålls endast för manuell återställning. Idempotens, sista giltiga snapshot och Blob-kostnadsgränser ska bevaras. | Implementerat; produktionsverifiering av nya nattkörningar återstår | `vercel.json`, `app/api/cron/refresh-data/route.ts`, `app/api/cron/process-reader-history/route.ts`, `app/api/cron/refresh-browser-sources/route.ts`, refresh-tester |

## 4. Aktiva datakällor och cachetider

Detta är aktuellt dokumenterat basläge. Använd [data-refresh-inventory.md](data-refresh-inventory.md) för fulla scheman, felhantering och detaljer. Ändra inventeringen om aktiv källa eller TTL ändras.

| Datapanel | Källor / funktion | Dokumenterad cachetid |
| --- | --- | ---: |
| Sport | API-Football/FotMob; valfri Sportmonks-berikning | 1 timme |
| Marknad | Yahoo Finance historiska stängningar | 24 timmar |
| Lokalt | Borås.com och Borås Stad som reservkälla för kommunhändelser | 2 timmar |
| Sverige/Riksdag | Riksdagens agenda och nyheter | 1 timme |
| Världen | Marknadsindikatorer, centralbanksräntor, World Bank BNP | 3 timmar |
| Kultur | DN:s film- och skivrecensioner | 4 timmar |
| Väder | Open-Meteo för Borås | 1 timme |
| Dagens header | Namnsdag och historik via konfigurerade källor | 7 dagar per datumnyckel |

Regler:

- Cachemedvetna `getCached…`-funktioner är standardingången.
- Lägg inte leverantörers liveanrop i sidkomponenter om det finns ett befintligt cache-/snapshotlager.
- En misslyckad upstream-hämtning får inte spara tom data som om det vore en lyckad uppdatering.
- Skillnaden mellan källfel, tom källa, inaktuell data och långsam respons ska bevaras.
- Uppdatering av supplemental snapshots och redaktionell artikelhämtning har skilda tidsfönster och ska inte blandas ihop.

## 5. Publicerings- och bakgrundsschema

Tider uttrycks i UTC i CI/cron-konfiguration men tidsgränser i applikationskod ska använda `Europe/Stockholm`.

| Jobb | Schemalagt i UTC | Ansvar |
| --- | --- | --- |
| Borås-händelser | 00.13 | Webbläsarhämtning och sparning av lokala event-snapshots. |
| Kompletterande fakta | 00.43 | Uppdatering av sport, marknad, lokalt, Riksdag, kultur, världsläge, väder och headerdata. |
| Fotbollskanalen-artiklar | 00.17, 01.17, 02.17, 03.17 UTC | Fyra nattliga försök med autentiserad preflight; skippa scrape och Blob-skrivning när dagens Stockholmssnapshot redan finns. Ingestion spärras fortsatt utanför 01.00–05.59 lokal tid. |
| Läshistorik/profil/Veckofokus | 02.15 | Konsolidera batchar, uppdatera ledger och profil-snapshot, försök igen med veckoläststatus och förbereda lördagens Veckofokus. |
| Morgonutgåva | Fyra Vercel-anrop: 04.30, 04.34, 05.30, 05.34 | De aktuella offset-paren täcker 06-timmen i CET/CEST; lokal tidsgrind tillåter bara 06.00–06.59 svensk tid. |

Viktiga invariants:

- Vercel Pro garanterar inte den exakta cron-minuten inom den valda UTC-timmen och utför inte automatiskt ett obegränsat felåterförsök.
- Den andra morgonkörningen ska undvika onödigt arbete när en giltig och tillräckligt färsk utgåva finns; vid markerad källhämtning som `retry` kan ett nytt försök göras.
- Nattjobben anropar produktionsrutter med kortlivad GitHub Actions OIDC-token. Routens autentisering ska kontrollera token-signatur, audience, repository, `main`-ref, godkänt workflow och tillåtet event.
- Deployment-protection-bypass tillåter endast passage av Vercels yttre skydd. Den ersätter aldrig routens OIDC-kontroll.
- `/api/cron/refresh-articles` är manuellt återställningsflöde, inte en parallell automatisk timkörning.
- Den explicita `manual=1`-vägen för nattlig läshistorik måste fortsätta kräva OIDC-auktorisering.
- Ingen kod får behandla en spoofbar `User-Agent` som tillräcklig autentisering för produktionsjobb.

## 6. Säkerhet, dataintegritet och prestanda

Dessa regler gäller oavsett vilken synlig funktion som ändras.

1. **Blob-kostnad:** inga nya skrivningar per klick, artikel eller sidrendering. Läshistorik skickas i begränsade batchar och konsolideras i bakgrunden.
2. **Last-good först:** ersätt inte verifierade historik-/snapshotdata med tomma data efter ett transient fel. Distinguera mellan ett giltigt tomt resultat och ett misslyckat anrop.
3. **Idempotens:** om en batch eller ett schemalagt jobb körs igen ska redan behandlade händelser och publicerade utgåvor inte dupliceras.
4. **Validera indata:** URL:er, datum, tidsstämplar och textlängder ska valideras vid API-/lagringsgränser.
5. **Minimera åtkomst:** privat Blob-lagring för användarhistorik och sparade interna snapshots där aktuell kod kräver det.
6. **Sekretess i loggar:** maskera API-nycklar, bearer-token, lösenord, query-secrets och andra känsliga strängar innan loggning.
7. **Cache och parallellitet:** återanvänd existerande cachefunktioner, behåll samtidighetskontroll och begränsa externa/AI-operationer i tid och parallellitet.
8. **Stabila kontrakt:** ändra inte lagringsformat, prefix, batch-ID, snapshotversion eller OIDC-scope utan att uppdatera konsumenter, tester och dokumentation samtidigt.
9. **Veckofokus:** behåll lördagsnyckel, persistent cache, in-flight-coalescing och förberedelse i nattjobbet.
10. **Migrationssignal:** ändra inte `.github/run-reader-history-migration` annat än när en avsiktlig migrering ska köras igen.

## 7. Testsamling och releasekrav

### Automatiserade testområden

- `tests/ranker-regression.test.cjs`: ranker, public importance, personaliseringstak, innehållstyper, källbredd, Veckofokus-kandidater, dubbletter, cachekoalescing, källhälsa, publiceringskontrakt, sporturval och retention.
- `tests/data-refresh-regression.test.cjs`: OIDC, tidsgrindar, schema, källinventering, fallback/snapshots, ligatabeller, profilsemantik, manuell återställning och byggkonfiguration.
- `tests/diagnostic-log-regression.test.cjs`: diagnostikmaskering, deduplicering, inga Blob-skrivningar per logg, Veckofokus-cache, läshistorik-ledger och nattprocessning.

Testerna ska återspegla önskat produktkontrakt, inte bara råka godkänna nuvarande implementation. När en bugg eller ett krav ändras ska relevant test läggas till eller uppdateras.

### Kommandon och CI

- Node.js 22 ska användas, i linje med CI.
- Lokal fullvalidering: `npm run build` (rankingtester + refresh-/diagnostiktester + `next build`).
- Kör `npm run lint` när TypeScript-/React-/källfiler ändras.
- `npm run test:ranker` och `npm run test:refresh` kan köras separat vid riktad felsökning.
- GitHub Actions kör regressionstester; Vercel sköter Next.js-produktionskompilering för preview/production. Lägg inte till en duplicerad full kompilering i CI.
- Endast ändringar som består helt av Markdown-dokumentation får hoppas över i Vercel-builds. Ändringar i kod, tester, konfiguration, workflow, script, assets eller dependencies ska behålla normal build. Ignore-skriptet ska fallera säkert och tillåta build om diff/SHA inte kan verifieras.
- Gör en sammanhängande, begränsad ändring och undvik repetitiva byggen eller deployer. Använd normalt branch och pull request; pusha inte direkt till `main` om det inte uttryckligen efterfrågas.

Källa: [AGENTS.md](../AGENTS.md), [package.json](../package.json), [CI-workflow](../.github/workflows/ci.yml), [Vercel-konfiguration](../vercel.json).

## 8. Kodägarskap — var en ändring ska börja

| Ändringsområde | Börja här |
| --- | --- |
| Startsida, synligt utgåveläge och redaktionell komposition | `app/page.tsx`, `lib/dailyEdition.ts`, `lib/editorV2.ts` |
| Ranking, aktualitet, nyhetsvärde och personliga signaler | `lib/ranker.ts`, `lib/topicCluster.ts`, `lib/articleType.ts` |
| RSS och förlagswebbplatser | `lib/rss.ts`, `lib/webSources.ts`, artikelcachemoduler |
| Veckofokus urval/kvalitet/cache | `lib/weekFocus.ts`, `lib/weekFocusCandidates.ts`, `lib/weekFocusQuality.ts`, `lib/weekFocusCache.ts` |
| Klickkö, batch-API, profil och ledger | `app/components/TrackableLink.tsx`, `readerQueue.ts`, `app/api/events/batch/route.ts`, `lib/readerProfile.ts` |
| Snapshot, TTL eller datauppdatering | `lib/dailySnapshots.ts`, `lib/supplementalCache.ts`, berörd source-specifik modul; läs [inventeringen](data-refresh-inventory.md) |
| Jobbautentisering och schema | Berörd route i `app/api/cron/`, tillhörande `.github/workflows/`, `lib/githubActionsAuth.ts` |
| Profil-/källstatus-/diagnostikgränssnitt | `app/profil/page.tsx`, `app/health/page.tsx`, `app/components/HealthLogPanel.tsx`, `lib/diagnosticLog.ts` |
| Global layout, navigation och responsivitet | `app/layout.tsx`, `app/globals.css`, `app/components/MobileNav.tsx` |

## 9. Förbjudna regressionsmönster

Inför inte följande utan uttryckligt nytt produktbeslut:

- Ett nätverksanrop eller en Blob-skrivning vid varje artikellänk/klick.
- AI-klassificering av varje klick i själva lässessionen.
- Livehämtning av RSS/redaktionella sidor före 06.00 svensk tid.
- En ny Veckofokus-generering för varje sidbesök eller separata lördags-/söndagsutgåvor.
- Fasta ligakvoter i fotbollssektionen.
- Att märka en gammal utgåva som dagens.
- Att radera/ersätta fungerande historik med tom data efter ett läs-/parsefel.
- Att låta långsam svarstid i sig betyda källfel.
- Att använda `User-Agent` eller Vercel bypass-header som enda autentisering av en route.
- Att lägga till en ny, parallell källa till en funktion när den etablerade adapter-/snapshotkedjan kan återanvändas.
- Att ta bort en regression assertion utan att ersätta den med motsvarande skydd för det avsedda kontraktet.

## 10. Produktavsikt som inte ska förväxlas med hårda kodregler

Följande intentioner har förekommit kring produkten, men får inte beskrivas som kodgarantier utan en separat verifiering och tydligt implementerat krav:

- **Normal läsperiod 07.00–11.00:** användningsmönster, inte en tidsgrind. Läsklick ska fortsatt kunna registreras andra tider.
- **Morgonupplaga vid 06.30:** publiceringsmål/färskhetsregel; Vercel Pro kan inte garantera en exakt körminut. Se avvikelsen i avsnitt 14.
- **Ingen återpublicering från de senaste dagarna:** nuvarande kod strävar efter en starkare sju-utgåvors dubblettgräns.
- **15 artiklar per kategori:** detta är inte nuvarande visningskontrakt. Aktuella urval är redaktionellt begränsade och kategori-/sportberoende; ändra inte antal utan produktbeslut.
- **Att extern artikel-läsning ingår i profilen:** endast registrerade Glenn News-interaktioner räknas automatiskt.
- **AI:s absoluta faktatrohet:** prompten instruerar om faktastöd och försiktighet men är inte bevis för att hallucinationer aldrig kan ske.

Om någon av dessa punkter senare blir ett uttryckligt krav måste motsvarande kod, tester, UI-texter och dokumentation uppdateras tillsammans.

## 11. Så använder framtida agenter kravspecifikationen

För varje uppgift:

1. Börja med detta dokument och identifiera relevanta krav-ID:n.
2. Läs de detaljdokument som länkas i kravraderna.
3. Inspektera ägande kod och befintligt test innan du ändrar något.
4. Beskriv kort vilken invariant som ska ändras och vilka andra invariants som måste överleva.
5. Implementera den minsta sammanhängande ändringen och uppdatera/addera regressionstest.
6. Uppdatera statusen i detta dokument och detaljdokument där beteendet eller dataflödet ändras. Om inget krav ändrats, redigera inte dokumentationen kosmetiskt.
7. Validera med relevanta tester, `npm run build` och vid källkod `npm run lint`. Dokumentera vad som faktiskt körts; hitta inte på att tester har passerat.
8. Rapportera kort: vad som ändrats, berörda krav-ID:n, tester och eventuell kvarvarande avvikelse.
9. Undvik direktpush till `main`, upprepade deployer och bred refaktorering som inte behövs för uppgiften.

## 12. Checklista innan en produktändring är klar

- [ ] Krav-ID:n och avsedda beteenden har identifierats.
- [ ] Befintligt beteende och fallbackvägar har kontrollerats i koden.
- [ ] Relevant regressionstest skyddar det nya eller bevarade kontraktet.
- [ ] Ingen ny per-klick/per-render-write, dold livehämtning eller onödig AI-körning har lagts till.
- [ ] Datum/tid använder rätt svensk tidszon där relevant.
- [ ] Fel, tom data, stale-data och reservläge är åtskilda.
- [ ] UI-guiden är uppdaterad om synligt beteende ändrats.
- [ ] Arkitektur- och data-refresh-dokument är uppdaterade om dataflöde, lagring, cache, autentisering eller schema ändrats.
- [ ] Den här kravspecifikationens kravstatus och avvikelselista är uppdaterade om det behövs.
- [ ] Rapporterad teststatus motsvarar faktiskt körda kontroller.

## 13. Översikt över centrala implementationer

För snabb orientering:

- Morgonutgåva och validering: [`lib/dailyEdition.ts`](../lib/dailyEdition.ts)
- AI-redaktör och urval: [`lib/editorV2.ts`](../lib/editorV2.ts)
- Ranker: [`lib/ranker.ts`](../lib/ranker.ts)
- RSS och webbkällor: [`lib/rss.ts`](../lib/rss.ts), [`lib/webSources.ts`](../lib/webSources.ts)
- Köad läshistorik: [`app/components/readerQueue.ts`](../app/components/readerQueue.ts), [batch-endpoint](../app/api/events/batch/route.ts)
- Profil, ledger och snapshot: [`lib/readerProfile.ts`](../lib/readerProfile.ts)
- Veckofokus: [`lib/weekFocus.ts`](../lib/weekFocus.ts), [cache](../lib/weekFocusCache.ts)
- Kompletteringsdata: [`lib/dailySnapshots.ts`](../lib/dailySnapshots.ts), [snapshot-fallback](../lib/supplementalCache.ts), [sport](../lib/sportDay.ts), [marknad](../lib/marketDay.ts), [väder](../lib/weather.ts)
- Flödeshälsa och diagnostik: [`lib/feedHealth.ts`](../lib/feedHealth.ts), [`lib/diagnosticLog.ts`](../lib/diagnosticLog.ts)
- Jobbauktorisering: [`lib/githubActionsAuth.ts`](../lib/githubActionsAuth.ts), [GitHub workflows](../.github/workflows)

## 14. Kända avvikelser som ska förbli synliga

### RECON-01 — publiceringsfönster 06.00–06.59 jämfört med färskhetsgräns 06.30

**Observerat:** Vercel cron-route accepterar anrop under hela 06.00–06.59 svensk tid. `isEditionGeneratedAfterMorningStart()` och `generateMorningEdition()` behandlar dock en utgåva som tillräckligt ny först när `generatedAt` är 06.30 eller senare. Hobby-cron kan starta före 06.30, och den exakta minuten är inte garanterad.

**Konsekvens:** Ett tidigt godkänt anrop kan skapa en utgåva före 06.30, som inte uppfyller den färskhetskontroll som används för att avgöra om dagens utgåva redan är klar. Det kan medföra att ett senare anrop gör mer redaktionellt arbete än väntat. En exakt garanterad publiceringstid är inte visad av nuvarande schemaläggning.

**För framtida agent:** Ändra inte 06.00, 06.30 eller retry-reglerna var för sig. Om uppgiften berör publicering, bestäm om 06.30 är ett strikt krav eller ett mål, och justera route, idempotens/färskhetskontroll, cron, fallback, tester och dokumentation samordnat.

### RECON-02 — beskrivningen av manuella `Uppdatera källor`

**Observerat:** Kontrollen på startsidan visas i det pre-06.00-fönster som är avsett för manuell underhållsuppdatering. `refreshNews()` förbjuder manuell körning från och med 06.00, och `canRefreshEditorialSourcesNow()` returnerar falskt före 06.00. Därför uppdaterar den aktuella manuella vägen kompletterande paneldata, inte RSS-/redaktionella artikelkällor, och den regenererar inte dagens sparade morgonutgåva.

**För framtida agent:** Beskriv kontrollen som en uppdatering av kompletterande paneler. Ändra inte detta till en omgenerering av morgonutgåvan; den separata återförsöksknappen är den avsedda vägen för det. UI-guiden ska beskriva koden, inte en tänkt tillåten redaktionell refresh.

### RECON-03 — täckning för faktatrohet och AI-redaktionella instruktioner

**Observerat:** `editorV2.ts` innehåller uttryckliga promptregler för faktastöd, försiktighet och motstånd mot instruktioner inuti artikelmaterialet. Det är instruktioner till modellen; det finns inte ett heltäckande deterministiskt test som kan bevisa att varje genererad mening alltid är korrekt belagd.

**För framtida agent:** Överdriv inte garantin. Om AI- eller promptlogiken ändras, behåll befintliga krav och överväg strukturell validering eller evalueringsfall om uppgiften kräver starkare verifiering.

### RECON-04 — kompletterande uppdatering kunde hoppas över utan fel (åtgärdad 27 oktober 2026)

**Observerat:** Den schemalagda GitHub Actions-körningen för kompletterande data startade 06.37 svensk tid den 27 oktober trots att den var planerad till 00.43 UTC. Workflowens tidsgrind hoppade över själva API-anropet, men jobbet rapporterades som lyckat. Startsidan fortsatte därför att visa tidigare snapshots och deras gamla hämtningstid.

**Åtgärd:** Flytta obligatorisk schemaläggning till två Vercel Cron-fönster före 06.00 Stockholmstid; behåll GitHub Actions som manuell OIDC-säkrad reservväg. Använd källspecifika TTL:er, beständig last-good-snapshot även för börsdata och HTTP 503 om ett jobb startar utanför nattfönstret. Faktapanelernas tidsstämplar ska visa datum och tid. Regressionstester skyddar dessa invariants.

**Begränsning:** Ingen schemaläggare eller extern datakälla kan garanteras vara tillgänglig. De två Vercel-körningarna minskar beroendet av en enda schemalagd körning, men om båda misslyckas ska **Nattlig uppdatering** och Vercels Runtime Logs kontrolleras. Browser-scraping av Borås.com och Fotbollskanalen är fortsatt beroende av GitHub Actions, men ett missat tidsfönster ska nu bli ett synligt fel.

### RECON-08 — Health diagnostic panel implied persistent Blob log history (observed 29 October 2026)

**Observed:** `lib/diagnosticLog.ts` intentionally returns `available: false` and no historical entries to avoid costly persistent Blob operations, while the UI and guide described logs as stored privately in Blob and could render an empty list/counters in a way that looked like no incidents had occurred.

**Resolution:** Keep persistent Blob diagnostic history disabled. The Health panel explains that diagnostics go to Vercel Runtime Logs, hides historical filters/counters when history is unavailable, clarifies that an empty local list is not proof of error-free production, and links to the Vercel project. Regression tests and the UI guide cover the behavior.

**Invariant:** Do not reintroduce Blob history or add reads/writes per page view/click to improve observability. Use Vercel Runtime Logs and GitHub Actions Issues for error handling; assess any paid log integration separately.

Tracked in [issue #56](https://github.com/brunofogaca-glenn/glenn-news/issues/56).

### Underhåll av avvikelselistan

Ta bort eller ändra ett avvikelse-ID först när koden, regressionstester och relevanta dokument är synkade. Lägg till nya avvikelser med observerad kod, konsekvens och vägledning till framtida agenter; håll denna lista kort och handlingsorienterad.


### RECON-05 — Fotbollskanalen schedule delay caused skipped scrape/ingestion runs (observed 29 October 2026)

**Observerat:** Produktionspanelen `/health` markerade Fotbollskanalen som inaktuell, med senaste daterade artikel 24 oktober 2026 kl. 14.00 svensk tid. De tidigare GitHub Actions-körningarna [#24 den 28 oktober](https://github.com/brunofogaca-glenn/glenn-news/actions/runs/40646434245) och [#25 den 29 oktober](https://github.com/brunofogaca-glenn/glenn-news/actions/runs/40833131784) startade efter kl. 06.00 och misslyckades i tidsgrinden; scraping och ingestion kördes därför inte.

**Åtgärd i kod:** PR #50 lades i produktion via commit [403464d](https://github.com/brunofogaca-glenn/glenn-news/commit/403464dbec1679ab7d530dfecac2b188910c514d). Den införde fyra nattliga schemaförsök, en autentiserad read-only preflight, idempotent ingestion samt 72-timmarsvalidering. Automatschemat är nu flyttat till två Vercel Cron-fönster per natt. En gemensam Vercel Sandbox kör endast de skrapare som behöver uppdateras; GitHub Actions har övergått till manuell återställning. Preflight hoppar över Sandbox och Blob-skrivning när dagens snapshot redan är aktuell. Tidsgränsen 01.00–05.59 och kravet på minst sex giltiga artiklar behålls. Den stora Fotbollskanalen-HTML-reserven hämtas utan Next.js-datacache eftersom svaret överskrider gränsen för cachelagrade svar.

**Verifiering efter migreringen:** Båda skraparna har körts framgångsrikt i en isolerad Vercel Sandbox under utvecklingstest och gav validerbara payloads. Den första schemalagda produktionskörningen måste fortfarande bekräfta att Vercel Cron startar rutten, att snapshots sparas och att `/health` visar nyare artikeldata. Den daterade morgonutgåvan skrivs inte om under dagen. Om produktionskörningen misslyckas, följ Vercel Runtime Logs och `/health` och återöppna ärendet.

Se [incidentanteckningen](incident-notes/2026-10-29-morning-data-quality.md) och [issue #49](https://github.com/brunofogaca-glenn/glenn-news/issues/49).

### RECON-06 — refresh-status bevisar inte att underliggande marknads- eller sportobservationer är aktuella (observerat 29 oktober 2026)

**Observerat:** En lyckad snapshot-refresh visar hämtning/lagring, inte nödvändigtvis när källan senast observerade värdet. Brentpanelens tidigare värde var USD 113,88 med datum 27 oktober. Financial Times historiska tabell gav en senare färdig stängning på USD 115,90 daterad 28 oktober 2026 vid källkontrollen den 29 oktober.

**Åtgärd i kod:** PR #50 lade in en reservhämtning från Financial Times när Yahoo BZ=F ligger efter de andra marknadsdatumen. Den senaste hämtningen måste fortfarande bekräftas i den sparade produktionssnapshoten vid nästa tillåtna nattjobb. Misslyckande ska lämna senaste giltiga snapshot kvar och visa varning, inte låtsas att värdet är nytt.

**Sporttabellens begränsning:** FotMob-payloaden som används för tabellraderna exponerar inte en separat observationstid. Sportpanelen anger därför hämtningstid och säger uttryckligen att den inte är källans observationstid. När snapshoten markeras stale visas dess senast sparade tid och varning. Detta förbättrar transparensen men ersätter inte en framtida verifiering mot en oberoende tabellkälla.

Se [incidentanteckningen](incident-notes/2026-10-29-morning-data-quality.md) och [issue #49](https://github.com/brunofogaca-glenn/glenn-news/issues/49).

### RECON-07 — Nattliga jobb kan missa skrivfönstret (observerat 29–31 oktober 2026)

**Observerat:** GitHub Actions kunde starta reader-history och browser-scraping långt efter 06:00 svensk tid. Dessa körningar stoppades av skrivfönstrets guard innan behandling, skrapning eller Blob-skrivning. Det visade ett schemaläggningsproblem, inte i sig ett fel i källornas markup.

**Nuvarande implementation — migrering till Vercel Cron/Sandbox den 31 oktober:**
- Reader-history körs av Vercel Cron vid `15 1,2 * * *` UTC. GitHub Actions är kvar som manuell OIDC-säkrad återställning och för den begränsade migration-marker-pushen.
- Borås.com och Fotbollskanalen körs av en gemensam Vercel Cron-route vid `13 2,3 * * *` UTC. Den kontrollerar båda fasta Blob-snapshot-patharna först och startar ingen Sandbox om båda snapshotarna redan är aktuella för dagens Stockholm-datum.
- När en källa behöver uppdateras startas en kortlivad Vercel Sandbox med Node 22 och Playwright 1.64.1/Chromium. Bara de skrapare som behöver uppdatering körs. Befintliga ingestion-rutter validerar payloaden och bevarar senaste giltiga snapshot vid fel.
- Automatiska GitHub Actions-scheman för de tre jobben är borttagna. Manuella OIDC-säkrade återställningsflöden finns kvar.
- Vercel Cron använder `CRON_SECRET`. `manual=1` för reader-history avvisas när anropet autentiseras med Cron-hemligheten; bypass kräver fortfarande den begränsade OIDC-auktoriserade migration-marker-pushen. Anrop utanför `01:00–05:59 Europe/Stockholm` ska returnera HTTP 503, inte en grön skip.

**Kostnads- och idempotenskontrakt:**
- Använd fasta privata Blob-paths och `get()`; lägg inte till `list()` för att hitta de två kända browser-snapshotarna.
- Preflight ska undvika Sandbox, skrapning och Blob-skrivningar när snapshotarna redan är aktuella.
- En normal lyckad dag ska kräva högst en browser-snapshot-`put()` per källa. Borås kan därutöver uppdatera den befintliga sammanslagna lokalsnapshoten; följ den operationen separat i kostnadsmätningen.
- Inga lock-/indexblobbar utan mätning och ett separat designbeslut. Reader-history behåller sin befintliga listning för att hitta väntande batchar; ingen ny listning har lagts till.
- Ledgerns `sourceLedgerUpdatedAt` fortsätter skydda profilsnapshoten mot redundanta skrivningar. Senaste giltiga data får inte ersättas med tom eller felaktig payload.

**Verifiering och status:** Migreringen är mergad till `main` och driftsatt. CI passerade för både migreringen och den efterföljande reader-history-säkerhetshärdningen; senaste produktionsdeployment `b6fc04b0fcbc549b5ed2e4cc8d25888a69f0c008` är READY. Den första nattliga produktionskörningen har ännu inte verifierats. Den ska bekräfta reader ledger/profilmarkören, minst sex giltiga kommande Borås-evenemang, minst sex giltiga Fotbollskanalen-artiklar med senaste artikel högst 72 timmar gammal, beständig sammanslagen lokalsnapshot, Sandbox-start/cleanup och no-op-beteendet vid andra Cron-fönstret. Mät Blob Advanced Operations innan beslut om att ta bort någon källa.

Se [reader-history recovery issue #54](https://github.com/brunofogaca-glenn/glenn-news/issues/54), [browser scraping issue #66](https://github.com/brunofogaca-glenn/glenn-news/issues/66), [migration tracking issue #69](https://github.com/brunofogaca-glenn/glenn-news/issues/69) och [backlog #52](https://github.com/brunofogaca-glenn/glenn-news/issues/52).

## 12. Agilt förbättringsarbete och kontinuerlig prioritering

Glenn News förbättras stegvis utifrån verklig användning. Arbetsflödet är definierat i [improvement-process.md](improvement-process.md), och den levande prioriteringen finns i [GitHub issue #52](https://github.com/brunofogaca-glenn/glenn-news/issues/52).

- Ta emot rapporter som signaler om användarupplevelsen; verifiera orsak i kod, loggar och tester innan slutsatser dras.
- Ha ett tydligt aktivt fokus och en kort prioriterad kö. Använd P0–P3 enligt förbättringsprocessen och prioritera användarpåverkan och korrekt data före kosmetik och nya funktioner.
- Arbeta med en avgränsad ändring i taget, skydda beteendet med regressionstester och uppdatera dokumentation tillsammans med koden.
- Följ kostnads- och driftsinvarianterna i detta dokument och AGENTS.md. Undvik onödiga Blob-operationer och upprepade deployar.
- Redovisa separat vad som är åtgärdat i kod, driftsatt och verifierat i produktion. Lämna okontrollerade livebeteenden markerade som väntande.
- När Glenn frågar efter nästa förbättring ska agenter läsa issue #52 och aktuell dokumentation, granska senaste feedback och verifierad produktionstatus och sedan välja nästa mest värdefulla steg.
