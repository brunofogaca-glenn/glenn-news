"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { readReaderQueue, READER_QUEUE_EVENT, READER_QUEUE_KEY } from "./readerQueue";
import { saveReaderBatch } from "./readerBatchClient";
function makeBatchId() { return String(Date.now()) + "-" + window.crypto.randomUUID().replaceAll("-", ""); }
export function SaveReadingHistoryButton() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  function refreshCount() { setCount(readReaderQueue().events.length); }
  useEffect(() => {
    refreshCount();
    window.addEventListener(READER_QUEUE_EVENT, refreshCount);
    window.addEventListener("storage", refreshCount);
    return () => { window.removeEventListener(READER_QUEUE_EVENT, refreshCount); window.removeEventListener("storage", refreshCount); };
  }, []);
  async function save() {
    const queue = readReaderQueue();
    if (saving || queue.events.length === 0) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await saveReaderBatch({
        queue, readQueue: readReaderQueue,
        writeQueue: next => sessionStorage.setItem(READER_QUEUE_KEY, JSON.stringify(next)),
        fetcher: fetch, createBatchId: makeBatchId,
      });
      refreshCount();
      setMessage(result.message);
    } catch {
      refreshCount();
      setMessage("Ett oväntat fel hindrade sparandet. Artiklarna ligger kvar i kön – försök igen.");
    } finally { setSaving(false); }
  }
  if (pathname !== "/") return null;
  return (
    <section className="mx-auto mt-10 max-w-7xl px-4 md:px-8 border-2 border-slate-950 bg-white/70 p-5 md:p-6" aria-label="Läshistorik">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">Din läshistorik</div>
          <h2 className="mt-1 font-serif text-2xl font-black">Spara morgonens läsning</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">Läsningen skickas tillsammans i en enda batch. Lässtatus och läsarprofil uppdateras av nattjobbet, inte medan du läser. Upp till 50 artiklar sparas per omgång.</p>
          {message && <p role="status" className="mt-2 text-sm font-semibold text-slate-700">{message}</p>}
        </div>
        <button type="button" onClick={save} disabled={saving || count === 0}
          className="shrink-0 border-2 border-slate-950 bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500">
          {saving ? "Sparar…" : count === 0 ? "Ingen läsning att spara" : "Spara läshistorik (" + String(count) + ")"}
        </button>
      </div>
    </section>
  );
}
