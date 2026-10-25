"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { readReaderQueue, READER_QUEUE_EVENT, READER_QUEUE_KEY, type ReaderQueueState } from "./readerQueue";

function makeBatchId() {
  return `${Date.now()}-${window.crypto.randomUUID().replaceAll("-", "")}`;
}

export function SaveReadingHistoryButton() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function refreshCount() {
    setCount(readReaderQueue().events.length);
  }

  useEffect(() => {
    refreshCount();
    window.addEventListener(READER_QUEUE_EVENT, refreshCount);
    window.addEventListener("storage", refreshCount);
    return () => {
      window.removeEventListener(READER_QUEUE_EVENT, refreshCount);
      window.removeEventListener("storage", refreshCount);
    };
  }, []);

  async function save() {
    const queue = readReaderQueue();
    if (saving || queue.events.length === 0) return;
    const selected = queue.events.slice(0, 50);
    const batchId = queue.batchId ?? makeBatchId();
    const prepared: ReaderQueueState = { ...queue, batchId };
    sessionStorage.setItem(READER_QUEUE_KEY, JSON.stringify(prepared));
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/events/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, events: selected }),
        cache: "no-store",
        credentials: "same-origin",
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; saved?: number } | null;
      if (!response.ok || result?.ok !== true) throw new Error("Sparandet misslyckades.");
      const current = readReaderQueue();
      const savedIds = new Set(selected.map(item => item.eventId));
      const remaining = current.events.filter(item => !savedIds.has(item.eventId));
      const next: ReaderQueueState = { events: remaining };
      sessionStorage.setItem(READER_QUEUE_KEY, JSON.stringify(next));
      setCount(remaining.length);
      setMessage(`Sparade ${selected.length} artiklar.${remaining.length ? " Spara igen för resten." : ""}`);
    } catch {
      setMessage("Kunde inte spara just nu. Artiklarna ligger kvar i kön – försök igen.");
    } finally {
      setSaving(false);
    }
  }

  if (pathname !== "/") return null;

  return (
    <section className="mx-auto mt-10 max-w-7xl px-4 md:px-8 border-2 border-slate-950 bg-white/70 p-5 md:p-6" aria-label="Läshistorik">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">Din läshistorik</div>
          <h2 className="mt-1 font-serif text-2xl font-black">Spara morgonens läsning</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
            Artiklarna samlas i webbläsaren och skickas tillsammans när du är klar. Upp till 50 artiklar sparas per omgång.
          </p>
          {message && <p role="status" className="mt-2 text-sm font-semibold text-slate-700">{message}</p>}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || count === 0}
          className="shrink-0 border-2 border-slate-950 bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
        >
          {saving ? "Sparar…" : count === 0 ? "Ingen läsning att spara" : `Spara läshistorik (${count})`}
        </button>
      </div>
    </section>
  );
}
