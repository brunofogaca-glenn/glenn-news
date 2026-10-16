"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshNews } from "@/app/actions";

function formatRefreshTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

export function ManualRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleRefresh() {
    setStatusMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const result = await refreshNews();
        const refreshedAt = formatRefreshTime(result.sourcesRefreshedAt);

        setStatusMessage(
          `Källor uppdaterade${refreshedAt ? ` kl. ${refreshedAt}` : ""}.${result.editorialRefreshDeferred ? " Artikelkällor uppdateras från 06.00." : " Dagens morgonedition är oförändrad."}`
        );

        // Refresh server-rendered source panels without a full page reload.
        // The saved morning edition intentionally remains the same.
        router.refresh();
      } catch (error) {
        console.error("Manuell källuppdatering misslyckades:", error);
        setErrorMessage(
          "Källorna kunde inte uppdateras helt. Försök igen om en stund."
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isPending}
        className="inline-flex items-center gap-2 border border-slate-400 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 transition hover:border-slate-950 hover:text-slate-950 disabled:cursor-wait disabled:opacity-50"
        aria-label="Uppdatera nyhetskällor och kringdata, inte morgoneditionen"
      >
        <span className={isPending ? "animate-spin" : ""} aria-hidden="true">
          ↻
        </span>
        {isPending ? "Hämtar källor…" : "Uppdatera källor"}
      </button>
      {statusMessage && (
        <p role="status" aria-live="polite" className="max-w-xs text-[10px] leading-4 text-emerald-700">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p role="alert" className="max-w-xs text-[10px] leading-4 text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
