"use client";

import { useState, useTransition } from "react";
import { retryMorningEdition } from "@/app/actions";

export function RetryMorningEditionButton() {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleRetry() {
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const result = await retryMorningEdition();
        if (result.totalArticles <= 0) {
          throw new Error("Dagens upplaga saknar artiklar.");
        }

        window.location.reload();
      } catch (error) {
        console.error("Försök att skapa dagens morgonedition misslyckades:", error);
        setErrorMessage(
          "Det gick inte att skapa dagens upplaga just nu. Försök igen om en stund."
        );
      }
    });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleRetry}
        disabled={isPending}
        className="inline-flex items-center gap-2 border border-current px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
      >
        <span className={isPending ? "animate-spin" : ""} aria-hidden="true">
          ↻
        </span>
        {isPending ? "Försöker skapa dagens upplaga…" : "Försök skapa dagens upplaga igen"}
      </button>
      {errorMessage && (
        <p role="alert" className="mt-2 text-sm font-bold">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
