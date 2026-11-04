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
      setMessage("Ett ovÃ¤ntat fel hindrade sparande¶»§q«^