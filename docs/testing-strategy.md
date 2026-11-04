# Glenn News — teststrategi

**Uppdaterad:** 3 november 2026

## Mål

Regressionstester ska bevisa beteenden som spelar roll för läsaren eller skydda viktiga drift- och dataintegritetsinvarianter. Ett grönt test ska inte bygga på att en viss funktionsdeklaration, kommentar eller CSS-sträng råkar finnas kvar.

Där det går ska testet köra den faktiska produktionsfunktionen eller route-handlern med kontrollerade gränser för tid, nätverk, Blob, autentisering och externa leverantörer. Det ska verifiera observerbara resultat, vilka sidoeffekter som skedde och vilka som **inte** skedde.

## Körning

| Kommando | Ansvar |
| --- | --- |
| \`npm run test:ranker\` | 13 beteendebaserade tester av kategorisering, ranking, Veckofokus och källhälsomått. |
| \`npm run test:critical\` | 30 beteendebaserade integrationstester av kritiska dataflöden samt ett separat CI-workflow-kontraktstest. |
| \`npm run test:refresh\` | Bakåtkompatibelt alias till \`npm run test:critical\`. |
| \`npm run build\` | Kör båda testsviterna före Next.js produktionsbyggnad. |

Nuvarande svit består av **44 tester**: 13 rankningstester, 30 kritiska flödestester och 1 workflow-kontraktstest. Antalet är en beskrivning av nuvarande täckning, inte ett kvalitetsmål.

## Vad de kritiska flödestesterna skyddar

### Morgonutgåva och källor

- En RSS-källa som svarar HTTP 503 ska inte stoppa andra källor.
- Den faktiska morgonutgåvegeneratorn ska filtrera gårdagens publicerade artikel, avvisa osäkra länkar, validera sju sektioner och spara dagens utgåva i en Blob-skrivning.
- Ogiltiga datum och dubbletter ska filtreras utan att giltiga artiklar försvinner.
- Källhälsa ska redovisa fel per källa i stället för att avbryta hela sammanställningen.
- Artikelhämtning ska respektera 06.00-gränsen i Europe/Stockholm.
- Artikeluppdateringen ska skilja mellan tolererbara källfel och en felandel som kräver retry.

### Nattjobb och isolerade fel

- Ett misslyckat kompletterande deljobb ska synas som ett eget fel; övriga källresultat ska fortfarande rapporteras.
- Ett redan lyckat nattjobb ska kunna hoppas över utan onödiga nya källanrop eller lagringsskrivningar.
- Ett missat tidsfönster får inte skapa ett falskt lyckat resultat eller starta dagtida Blob-skrivningar.

### Borås.com

- Katalogens merge-logik bevarar senast giltiga data vid partiell hämtning och hanterar normalisering, upprepade frånvarotillfällen, avbokningar och återkommande evenemang.
- En ofullständig eller för liten skrapning får inte ersätta den senast giltiga evenemangskatalogen.
- URL-varianter ska normaliseras; oförändrat innehåll ska inte räknas som en innehållsförändring.
- Ett frånvarande evenemang ska inte avpubliceras förrän flera kompletta skrapningar bekräftat frånvaron. Avbokningar och återkommande evenemang ska hanteras korrekt.

### Läshistorik och personalisering

- Nya veckolänkar läggs före historiken, redan sparade länkar flyttas inte, dubbletter tas bort och befintlig ordning bevaras.
- Transienta Blob-fel och felaktig JSON får inte utlösa en skrivning som ersätter befintlig historik.
- Batch-API:t ska avvisa ogiltiga länkar och felaktiga händelser innan lagring.
- Nattlig konsolidering ska samla flera läshändelser i en ledger, vara idempotent och inte skapa nya Blob-skrivningar för redan bearbetade batcher.
- Ett oläsbart ledger- eller weekly-read-snapshot får aldrig behandlas som en tom historik och skrivas över.
- Profiluppdateringen ska avbrytas om veckans lässtatus inte kunde sparas.
- En oförändrad profil ska inte skrivas om; valfri Veckofokus-förhandsberäkning får inte fälla hela nattjobbet.

### Diagnostik

- Loggar ska maskera autentiseringsuppgifter och känsliga URL-parametrar, endast släppa igenom godkända kontextfält och deduplicera identiska fel.

## Testnivåer

1. **Enhetstester:** rena funktioner som kategorisering, ranking, datumgränser, normalisering och poängsättning.
2. **Integrationstester:** faktiska route-handlers och tjänster kopplade till kontrollerade fetch-, Blob-, auth- och klockgränser.
3. **Produktionsverifiering:** schemalagda jobb, Vercel-runtime, cache och användarsynligt resultat. Detta kan inte bevisas av enhetstest eller en grön deployment ensam.

## Regler för framtida ändringar

- Varje korrigering av ett produktionsfel ska ha ett test som reproducerar felet före fixen och passerar efter fixen.
- Testa både det förväntade resultatet och skyddade sidoeffekter: antal Blob-skrivningar, cacheinvalidering, retry-status, idempotens och att friska deljobb fortsätter.
- Mocka systemgränser, inte den produktionsfunktion vars beteende testet ska bevisa.
- Undvik tester som enbart söker efter namn, kommentarer, regex-matchningar, JSX-strängar eller CSS-klasser. Ett litet antal kontraktstester kan vara motiverade för CI-konfiguration som inte har en körbar lokal implementation; märk dem då som kontraktstest, inte funktionstest.
- Lägg inte till tester för att nå ett visst antal. Lägg till testet som fångar ett konkret fel eller en viktig invariant.
- När en starkare scenariotest täcker samma beteende, ta bort den redundanta kontrollen och uppdatera den här kartan.

## Kända begränsningar

Den här sviten är inriktad på serverflöden, data och driftssäkerhet. Den innehåller ännu ingen riktig webbläsarbaserad visuell regressionstestning av surfplattelayout, faktarutors placering eller interaktioner i användargränssnittet. Sådan täckning ska införas med ett separat browser-E2E-upplägg och får inte beskrivas som bevisad av dessa 44 tester.

Ett test med simulerad Blob eller leverantörsrespons bevisar integrationens logik, inte att Vercel Blob, en extern RSS-leverantör, Borås.com eller den schemalagda produktionstriggen fungerar just då. Behåll separata driftkontroller för dessa beroenden.
