"use client";

import { useTransition } from "react";
import { refreshNews } from "@/app/actions";

export function ManualRefreshButton() {
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshNews();
        window.location.reload();
      } catch (error) {
        console.error("Manuell nyhetsuppdatering misslyckades:", error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isPending}
      className="inline-flex items-center gap-2 border border-slate-400 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 transition hover:border-slate-950 hover:text-slate-950 disabled:cursor-wait disabled:opacity-50"
      aria-label="Uppdatera nyheterna manuellt"
    >
      <span className={isPending ? "animate-spin" : ""}>↻</span>
      {isPending ? "Uppdaterar…" : "Uppdatera"}
    </button>
  );
}
