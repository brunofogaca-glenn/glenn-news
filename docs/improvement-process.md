# Glenn News — små, kontinuerliga förbättringar

## Källa till sanning

- [Issue #52](https://github.com/brunofogaca-glenn/glenn-news/issues/52) är den korta, levande arbetskön. Håll högst tre aktiva prioriteringar där.
- Varje konkret leverans ägs av ett eget GitHub-issue.
- [product-requirements.md](product-requirements.md) beskriver avsett produktbeteende och tekniska invarianter.
- [architecture.md](architecture.md), [ui-feature-guide.md](ui-feature-guide.md) och [data-refresh-inventory.md](data-refresh-inventory.md) beskriver bara de delar som påverkas av en ändring.
- [AGENTS.md](../AGENTS.md) anger regler för implementation och verifiering i repot.

Kopiera inte hela backloggen, acceptanskriterier eller långa statusloggar till #52. Länka till ärendet som äger leveransen.

## Storleksregeln

Varje ärende som väljs för implementation ska beskriva **ett observerbart resultat** som kan levereras i en fokuserad PR.

| Storlek | Riktmärke | Beslut |
| --- | --- | --- |
| XS | En liten ändring, oftast 1–2 filer | Redo |
| S | Ett beteende eller en avgränsad bugg, oftast 3–5 filer | Föredras |
| M | En vertikal leverans, 6–8 filer eller flera lager | Redo endast med kort motivering till varför den inte kan delas mindre |
| L | Fler än 8 filer, flera oberoende beteenden eller flera separat verifierbara resultat | Inte redo: dela upp före kodning |

Antal filer är en varningssignal, inte ett mål eller en absolut gräns. En vertikal leverans kan rimligen beröra UI, API, lagring och tester. Dela inte en sammanhängande leverans i PR:ar som inte fungerar självständigt.

En uppgift är för stor när den:
- ändrar mer än ett oberoende användar- eller driftbeteende;
- blandar implementation med orelaterad refaktorering, testombyggnad eller dokumentationsstädning;
- har fler än fem acceptanskriterier som kan godkännas eller underkännas var för sig;
- inte går att beskriva i en mening utan att rada upp flera olika saker.

Om ett ärende är för stort: behåll det som EPIC/förälder bara om det finns minst två verkligt oberoende leveranser. Skapa små barnärenden, vart och ett med eget resultat och egna acceptanskriterier. Annars skriv om ärendet till den första tunna leveransen och flytta senare idéer tillbaka till backloggen.

## Mall för ärenden

Använd en av dessa typer i titel eller beskrivning:

- **BUG** — ett trasigt beteende, med reproduktion/evidens och förväntat resultat.
- **TASK** — en liten implementation eller undersökning.
- **VERIFY** — en enda produktionskontroll efter en release.
- **EPIC** — förälder till minst två självständigt levererbara barnärenden; aldrig en kodningsuppgift i sig.

Varje implementationsärende ska innehålla:
1. **Resultat:** en mening om vad som ska bli annorlunda.
2. **Omfattning:** vad som ingår och uttryckligen inte ingår.
3. **Klart när:** normalt 2–5 observerbara kontroller.
4. **Skyddsräcken:** bara de invarianter som är relevanta för ändringen.

Lägg inte in spekulativa acceptanskriterier för framtida faser. Skapa inte ärenden för möjligheter som inte har triagerats.

## PR-regler

- En aktiv PR per sammanhängande ärende/arbetsström.
- En PR har ett syfte. Ta bara med tester och dokumentation som behövs för just det syftet.
- Sikta på 1–5 ändrade filer. 6–8 kräver en kort motivering. Fler än 8 kräver uppdelning eller en uttrycklig förklaring till varför en enda vertikal leverans är säkrare.
- Lägg inte till orelaterad städning, breda testomskrivningar eller ”när vi ändå är här”-förbättringar.
- Före merge: läs hela diffen, kör relevanta regressionstester, verifiera GitHub CI på exakt head-SHA och kontrollera Vercel Preview när appbygget påverkas.
- En READY Preview, en grön Vercel-status eller en äldre grön Actions-körning bevisar inte att aktuell GitHub CI är grön.
- Undvik upprepade byggen/deployments för mellanändringar. Pusha inte direkt till main om det inte uttryckligen efterfrågas.

## Regler för verifiering

Ett VERIFY-ärende ska beskriva en enda kontroll, inte fungera som en samlad checklista för oberoende uppföljningar.

- Ange exakt produktionssignal, datafält, route, sida eller användaråtgärd som ska kontrolleras.
- Ange vad som räknas som godkänt och vad som inte får ändras under kontrollen.
- Gör inte produktionsdatamutationer eller manuella Cron-körningar utan uttryckligt godkännande och säker kontroll.
- Om verifieringen väntar på en framtida schemalagd körning: markera **väntar på nästa schemalagda körning**, ange deployment och nästa kontroll. Låt inte ett utvecklingsärende ligga öppet bara för att vänta.
- Stäng VERIFY-ärendet direkt när den angivna kontrollen passerar. Om den misslyckas, skapa en liten BUG för det observerade felet och stäng/ersätt verifieringsärendet på lämpligt sätt.
- Beskriv aldrig ”fixat i kod”, ”mergat”, ”driftsatt” och ”verifierat i produktion” som samma status.

## Arbetsgång

1. Kontrollera #52 och aktiv PR innan du börjar. Skapa inte dubbletter eller parallella PR:ar.
2. Välj det högst prioriterade ärende som är redo. Om det är L-stort ska det delas före kodning.
3. Läs relevanta produktkrav, ägande modul, närmaste test och aktuell produktionsevidens — inte hela repot i onödan.
4. Gör en komplett, avgränsad ändring och lägg till det minsta regressionstest som skulle ha fångat felet.
5. Uppdatera bara dokumentation som påverkas av beteendet eller en teknisk invariant.
6. Granska diff och relevanta kontroller en gång. Rätta fel; kör inte om godkända kontroller utan ny relevant ändring.
7. Uppdatera ägarärendet och #52 med evidens, osäkerhet och nästa enda åtgärd.
8. Gå vidare. Låt inte den öppna PR:en växa med nyupptäckta, orelaterade uppgifter.

## Prioritering

- **P0:** säkerhet, integritet, dataförlust eller att den centrala tjänsten ligger nere.
- **P1:** morgonutgåvan eller ett centralt läsarflöde är trasigt eller vilseledande.
- **P2:** en avgränsad funktion eller ett återkommande fel med tydligt användarvärde.
- **P3:** putsning och valfria framtida idéer.

Prioritet upphäver inte storleksregeln. Dela en P1 i små och säkra leveranser i stället för att skapa en stor akut-PR.

## Permanenta skyddsräcken

- Inga Blob-skrivningar per klick, artikel eller rendering. Behåll begränsade batchskrivningar och nuvarande kostnadstak.
- Behåll privata paths, idempotens, skrivfönster 01:00–05:59 Europe/Stockholm, autentisering och last-good-data.
- Ersätt aldrig giltig historik/snapshot med tom data efter tillfälliga läs- eller parsefel.
- Behåll redaktionella källspärrar och befintlig cache/coalescing.
- Lägg inte till AI-anrop, upstream-anrop, Blob-operationer, betalbara observability-produkter eller schemabyten utan ett separat motiverat beslut.
- Dokumentation ska beskriva verifierat beteende, inte avsedd framtida funktion.

## Aktuellt arbete

Aktuell status och de tre nästa prioriteringarna finns endast i [Issue #52](https://github.com/brunofogaca-glenn/glenn-news/issues/52). Håll inte en separat daterad statuslogg i detta dokument.