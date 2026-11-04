import { MAX_READER_BATCH_SIZE, type ReaderQueueState } from "./readerQueue";
type BatchError = { code?: string; message?: string; eventIndex?: number; field?: string; fieldLabel?: string };
type BatchResponse = { ok?: boolean; saved?: number; queuedForNightlyProcessing?: boolean; error?: BatchError | string };
export type ReaderBatchSaveResult =
  | { ok: true; saved: number; remaining: number; message: string }
  | { ok: false; message: string };
type Dependencies = {
  queue: ReaderQueueState; readQueue: () => ReaderQueueState; writeQueue: (queue: ReaderQueueState) => void;
  fetcher: (input: string, init: RequestInit) => Promise<Response>; createBatchId: () => string;
};
const FIELD_LABELS: Record<string, string> = {
  eventId: "händelse-ID", timestamp: "datum", category: "kategori", articleType: "artikeltyp",
  source: "källa", topic: "ämne", title: "rubrik", summary: "sammanfattning", link: "artikellänk",
};
function failureMessage(response: Response, result: BatchResponse | null, count: number) {
  const error = result?.error;
  const structured = error && typeof error === "object" ? error : null;
  const detail = typeof error === "string" ? error : structured?.message;
  if (detail) {
    const label = structured?.fieldLabel ?? (structured?.field ? FIELD_LABELS[structured.field] : undefined);
    const location = typeof structured?.eventIndex === "number"
      ? " (artikel " + String(structured.eventIndex + 1) + (label ? ", " + label : "") + ")"
      : "";
    return detail + location + " Inget har tagits bort från kön.";
  }
  if (response.status === 413) return "Läshistoriken är för stor för en sparning. Artiklarna ligger kvar i kön.";
  if (response.status === 400) return "Servern kunde inte godkänna batchen. Artiklarna ligger kvar i kön.";
  if (response.status === 503) return "Lagringen är tillfälligt otillgänglig. Artiklarna ligger kvar i kön.";
  return "Sparandet misslyckades (HTTP " + response.status + "). " + String(count) + " artiklar ligger kvar i kön.";
}
/** Persist a stable ID before POST; only remove queue entries after full server confirmation. */
export async function saveReaderBatch({ queue, readQueue, writeQueue, fetcher, createBatchId }: Dependencies): Promise<ReaderBatchSaveResult> {
  if (!queue.events.length) return { ok: true, saved: 0, remaining: 0, message: "Det finns ingen läsning att spara." };
  const selected = queue.events.slice(0, MAX_READER_BATCH_SIZE);
  const batchId = queue.batchId && /^[0-9]{13}-[a-f0-9]{32}$/i.test(queue.batchId) ? queue.batchId : createBatchId();
  try { writeQueue({ ...queue, batchId }); }
  catch { return { ok: false, message: "Webbläsaren kunde inte bevara din kö inför sparandet. Inget skickades; låt fliken vara öppen och försök igen." }; }
  // The nightly ledger does not retain article summaries, so do not upload them.
  const events = selected.map(({ summary: _summary, ...event }) => event);
  let response: Response;
  try {
    response = await fetcher("/api/events/batch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId, events }), cache: "no-store", credentials: "same-origin",
    });
  } catch { return { ok: false, message: "Kunde inte nå servern. Alla " + String(queue.events.length) + " artiklar ligger kvar i kön – försök igen." }; }
  let result: BatchResponse | null;
  try { result = await response.json() as BatchResponse; }
  catch { return { ok: false, message: "Servern gav ett oläsligt svar (HTTP " + response.status + "). Artiklarna ligger kvar i kön." }; }
  if (!response.ok || result?.ok !== true || result.saved !== selected.length) {
    return { ok: false, message: failureMessage(response, result, queue.events.length) };
  }
  try {
    const current = readQueue();
    const savedIds = new Set(selected.map(item => item.eventId));
    const remainingEvents = current.events.filter(item => !savedIds.has(item.eventId));
    writeQueue({ events: remainingEvents });
    return {
      ok: true, saved: selected.length, remaining: remainingEvents.length,
      message: "Sparade " + String(selected.length) + " artiklar. De bearbetas nattetid." + (remainingEvents.length ? " Spara igen för resten." : ""),
    };
  } catch {
    return { ok: false, message: "Servern sparade " + String(selected.length) + " artiklar, men webbläsarens kö kunde inte uppdateras. Samma batch-ID behålls för ett säkert återförsök." };
  }
}
