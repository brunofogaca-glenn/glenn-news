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
| [UI- och funktionsguide](ui-feature-guide.md) |���q�^