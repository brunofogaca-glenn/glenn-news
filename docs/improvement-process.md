# Glenn News — löpande förbättringsarbete

**Syfte:** ge Glenn News ett återkommande, lättviktigt och spårbart arbetssätt där användarens erfarenheter styr nästa förbättring. Målet är att förbättra tjänsten steg för steg utan att tappa fungerande beteenden, skapa onödig komplexitet eller återinföra kostnadsproblem.

## Källor och ansvar

- **[Samlingsärende för aktivt fokus och backlog (#52)](https://github.com/brunofogaca-glenn/glenn-news/issues/52):** aktuell prioritering, status, nästa kö och uppdateringslogg. Detta är den levande arbetslistan.
- **Produktkrav** ([product-requirements.md](product-requirements.md)): avsett produktbeteende, krav-ID:n, tekniska invariants och kända avvikelser.
- **[UI- och funktionsguide](ui-feature-guide.md):** vad användaren möter i gränssnittet.
- **[Arkitekturdokumentation](architecture.md):** ägande moduler och dataflöden.
- **[Data-refresh-inventering](data-refresh-inventory.md):** källor, färskhet, scheman och reservbeteenden.
- **[Agentregler](../AGENTS.md):** undersökning, validering, gren/PR och releasehygien.

Issue #52 ska länkas till relevanta separata buggar/PR:ar. Dokumentet här beskriver processen; issue #52 håller den uppdaterade arbetsstatusen. Ändra inte produktkrav för att få dokumentation att se ut att matcha kod: dokumentera avvikelsen och lös den medvetet.

## Den kontinuerliga förbättringskedjan

Följ samma loop för varje förbättring:

1. **Lyssna och fånga signalen.** Registrera användarens rapport eller återkoppling så som den upplevs. Skilj mellan det observerade beteendet och en ännu obekräftad förklaring.
2. **Triage och prioritera.** Kontrollera om problemet redan är känt. Bedöm användarpåverkan, frekvens, hur centralt beteendet är, evidens/reproducerbarhet, risk att ändra samt kostnad/driftspåverkan. Uppdatera issue #52 och öppna ett separat GitHub-ärende när problemet behöver egen livscykel.
3. **Undersök före ändring.** Läs produktkrav först; inspektera sedan relevant implementation, närliggande regressionstest, produktionsloggar och senaste driftsättning. En grön byggning eller frånvaro av loggar bevisar inte i sig att användarbeteendet fungerar.
4. **Välj en liten, sammanhängande ändring.** Ha normalt ett tydligt huvudmål per PR. Undvik breda ombyggnader, nya beroenden och nya funktioner som inte behövs för att lösa det prioriterade problemet.
5. **Skydda beteendet.** Lägg till eller justera regressionstest som fångar felet. Behåll befintliga cache-, tidsfönster-, idempotens-, reservdata-, säkerhets- och kostnadsinvarianter.
6. **Dokumentera tillsammans med koden.** Uppdatera produktkrav, UI-guide, arkitektur eller data-refresh-inventering när respektive kontrakt ändras. Uppdatera ärendets status och ändringslogg.
7. **Validera och leverera sparsamt.** Följ [AGENTS.md](../AGENTS.md): normalt en arbetsgren och PR, relevanta tester, lint när källkod ändras och så få onödiga byggen/deployar som möjligt. Dokumentationsändringar ska inte skapa produktionsdeploy i onödan.
8. **Verifiera och lär.** Separera vad som är ändrat i kod, vad som är driftsatt och vad som faktiskt är verifierat i produktion. När liveverifiering inte är möjlig ännu ska det stå kvar som väntande.
9. **Välj nästa sak.** Stäng inte loopen förrän aktivt fokus och nästa kö är uppdaterade. Ny användarfeedback kan alltid omprioritera kön.

## Prioritering

Använd nivåerna som stöd, inte som mekanisk poängräkning.

| Prioritet | När den används | Förväntad hantering |
| --- | --- | --- |
| **P0 — akut** | Säkerhetsproblem, dataläckage, dataförlust eller att tjänstens centrala flöde är nere. | Stoppa annat arbete och hantera omedelbart inom säkra releasegränser. |
| **P1 — hög** | Morgonutgåvan är felaktig/inaktuell, centrala funktioner misslyckas återkommande eller fel ger vilseledande information. | Nästa fokus om inte P0 finns. |
| **P2 — normal** | En isolerad funktion/panel, läshistorik eller interaktion har ett reproducerbart fel eller en tydlig återkommande brist. | Prioritera efter påverkan och om den blockerar daglig användning. |
| **P3 — förbättring** | Visuell putsning, mindre friktion eller nya idéer utan tydlig funktionsrisk. | Ta när högre prioriterade problem är verifierade och stängda. |

När två saker har samma nivå, föredra det som påverkar den dagliga läsningen mest, har tydligast evidens och kan lösas säkert med minst ändringsyta. En rapport från Glenn är viktig produktfeedback, men anta inte teknisk orsak förrän den undersökts.

## Så hanterar vi återkommande frågor i chatten

### När Glenn rapporterar en bugg

- Sammanfatta kort vad som observerats och vilket beteende som borde ske.
- Undersök befintlig kod, relevanta loggar, tester och dokumentation innan du föreslår en orsak.
- Registrera buggen i issue #52 och, om det behövs, skapa ett separat GitHub-ärende med steg för att återskapa, påverkan, evidens, relevanta krav och testidé.
- Om felet är tydligt, avgränsat och säkert att åtgärda: gör en riktad fix med regressionstest enligt repositoryts regler. Om det kräver ett större produktbeslut eller saknar avgörande underlag, dokumentera status och föreslå nästa konkreta undersökning i stället för att gissa.
- Prioritera om aktivt fokus när felet har större påverkan än pågående arbete.

### När Glenn frågar ”vad är nästa förbättringsområde?”

1. Läs issue #52 och detta arbetsflöde.
2. Kontrollera ny användarfeedback, relevanta öppna ärenden, senaste produktionsfel och de senaste releaserna.
3. Skilj mellan gammal historik, åtgärdat i kod, driftsatt och verifierat i produktion.
4. Rekommendera ett huvudområde med konkret motivering, klart avslutskriterium och minsta rimliga arbetssteg.
5. Om Glenn vill genomföra arbetet, fortsätt enligt samma loop. Börja inte en stor, osammanhängande ombyggnad bara för att det finns fler idéer.

### När en ändring är klar

Uppdatera issue #52 med:
- **Aktuellt fokus:** vad som är i arbete eller väntar på verifiering.
- **Status:** nytt, triagerat, pågår, åtgärdat i kod, driftsatt, verifierat, parkerat eller ersatt.
- **Bevis:** PR/commit, tester, relevanta loggar och vad som kontrollerats manuellt.
- **Kvarstående osäkerhet:** vad som ännu inte går att hävda.
- **Nästa kö:** högst tre konkreta punkter i prioriterad ordning.
- **Ändringslogg:** datum och en kort notering.

Markera inte produktionsverifiering enbart utifrån att en PR slagits samman, Vercel visar READY eller tester går grönt. Verifiera det berörda beteendet/dataflödet där det är möjligt.

## Skyddsräcken som alltid gäller

- Kvalitet, korrekt information och förtroende går före antal funktioner.
- Behåll kostnadsdisciplinen: inga Blob-skrivningar per klick/rendering, inga duplicerade hämtningar eller dyra AI-anrop utan tydligt värde.
- Behåll dataskydd: tidsfönster, autentisering, idempotens, last-good-snapshot och skydd mot att giltig historik ersätts med tom data vid fel.
- För redaktionell data: skilj mellan senaste hämtningstid och observationens/artikelns datum. Visa gammal eller partiell data tydligt.
- Förändra inte fungerande produktbeteenden som sidoeffekt av en orelaterad fix.
- Undvik flera parallella experimentella fixar, repetitiva produktionsbyggen och direkta pushar till main.
- Dokumentera endast det som är sant och verifierat; kalla inte intention för garanti.

## Startläge — 29 oktober 2026

Det första aktiva fokuset är **att verifiera morgonflödets datakvalitet efter de senaste produktionsfixarna**. Kontrollera vid nästa tillåtna nattkörning:

1. Fotbollskanalen: minst sex giltiga artiklar enligt den aktuella kontrollen, lyckad import, nyare artikelunderlag och aktuell källhälsostatus.
2. Marknadsdata/Brent: att observationsdatum och värde har uppdaterats, eller att inaktuell status fortfarande visas tydligt.
3. Kategorisering: fotbollsanalys ska inte hamna under Kultur, Mat & Livsstil.
4. Sportpanel: hämtningstid får inte framstå som bevis för ett okänt observationsdatum.

Den här kontrollen är **väntande liveverifiering**, inte ett påstående om att dessa förhållanden redan är bekräftade i produktion. Följ nattfönstret och återställningsreglerna i data-refresh-inventeringen och incidentanteckningarna. Se [samlingsärende #52](https://github.com/brunofogaca-glenn/glenn-news/issues/52) för aktuell status.
