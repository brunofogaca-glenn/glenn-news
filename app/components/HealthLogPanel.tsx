"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type DiagnosticLogEntry = {
  id: string;
  timestamp: string;
  level: "error" | "warning";
  component: string;
  message: string;
  detail?: string;
  stack?: string;
  context: Record<string, string | number | boolean | null>;
  fingerprint: string;
};

type LogsResponse = {
  ok: boolean;
  available?: boolean;
  entries?: DiagnosticLogEntry[];
  truncated?: boolean;
  message?: string;
  commit?: string | null;
  generatedAt?: string;
};

function formatTimestamp(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm", dateStyle: "short", timeStyle: "medium",
  }).format(new Date(timestamp));
}

function levelLabel(level: DiagnosticLogEntry["level"]) {
  return level === "error" ? "FEL" : "VARNING";
}

function formatEntry(entry: DiagnosticLogEntry) {
  return [
    "[" + levelLabel(entry.level) + "] " + formatTimestamp(entry.timestamp),
    "Komponent: " + entry.component,
    "Meddelande: " + entry.message,
    entry.detail ? "Detalj: " + entry.detail : "",
    Object.keys(entry.context).length ? "Kontext: " + JSON.stringify(entry.context) : "",
    entry.stack ? "Stack:\n" + entry.stack : "",
    "Logg-ID: " + entry.id,
  ].filter(Boolean).join("\n");
}

export function HealthLogPanel() {
  const [days, setDays] = useState<1 | 7>(1);
  const [level, setLevel] = useState<"all" | "error" | "warning">("all");
  const [entries, setEntries] = useState<DiagnosticLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [available, setAvailable] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [commit, setCommit] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);
  const [copied, setCopied] = useState("");

  const loadLogs = useCallback(async (range: 1 | 7) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/health/logs?days=" + range, { cache: "no-store" });
      const result = await response.json() as LogsResponse;
      setAvailable(Boolean(result.available));
      setEntries(Array.isArray(result.entries) ? result.entries : []);
      setTruncated(Boolean(result.truncated));
      setCommit(result.commit ?? null);
      setLastLoaded(result.generatedAt ?? new Date().toISOString());
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "Loggarna kunde inte hämtas just nu.");
      }
    } catch {
      setAvailable(false);
      setMessage("Kunde inte hämta diagnostikstatus. Kontrollera Vercel Runtime Logs och försök igen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadLogs(days); }, [days, loadLogs]);

  const visibleEntries = useMemo(
    () => entries.filter(entry => level === "all" || entry.level === level),
    [entries, level]
  );

  const reportText = useMemo(() => [
    "GLENN NEWS — FELSÖKNINGSRAPPORT",
    "Tidsperiod: senaste " + days + (days === 1 ? " dygnet" : " dagarna"),
    "Skapad: " + (lastLoaded ? formatTimestamp(lastLoaded) : "okänd"),
    "Git-commit: " + (commit ?? "okänd"),
    "Antal loggrader: " + visibleEntries.length,
    truncated ? "OBS: Visningen är begränsad till de senaste 80 loggarna." : "",
    "",
    ...visibleEntries.map((entry, index) => "===== LOGG " + (index + 1) + " =====\n" + formatEntry(entry)),
    "",
    "Integritet: typiska hemligheter och URL-frågeparametrar maskeras före diagnostiken skrivs till Vercel Runtime Logs; historiken sparas inte i Blob.",
  ].filter(Boolean).join("\n\n"), [days, lastLoaded, commit, visibleEntries, truncated]);

  async function copyText(value: string, id: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
    } catch {
      setMessage("Kopiering nekades av webbläsaren. Markera texten i den tekniska detaljvyn och kopiera manuellt.");
    }
  }

  return (
    <section className="mt-8 border-y-2 border-slate-950 py-5">
      <div className="flex flex-col gap-3 border-b border-slate-300 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">Felsökning</div>
          <h2 className="mt-1 font-serif text-2xl font-black">Fel- och loggpanel</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            Diagnostik skrivs till Vercel Runtime Logs. Historisk felloggning i Blob är avstängd för att minska Advanced Blob Operations.
            Tom historik här betyder därför inte att produktionen saknat fel.
          </p>
          <a href="https://vercel.com/glenn-holvik-s-projects/glenn-news" target="_blank" rel="noreferrer"
            className="mt-2 inline-flex text-xs font-bold text-slate-700 underline underline-offset-2 hover:text-slate-950">
            Öppna projektet i Vercel ↗
          </a>
        </div>
        <button
          type="button" onClick={() => void loadLogs(days)} disabled={loading}
          className="inline-flex w-fit border border-slate-500 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700 hover:border-slate-950 hover:text-slate-950 disabled:opacity-50"
        >
          {loading ? "Hämtar loggar…" : "↻ Uppdatera loggar"}
        </button>
      </div>

      {available && <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="font-bold text-slate-600" htmlFor="diagnostic-range">Period</label>
          <select id="diagnostic-range" value={days}
            onChange={event => setDays(event.target.value === "7" ? 7 : 1)}
            className="border border-slate-300 bg-white px-3 py-2">
            <option value={1}>Senaste 24 timmarna</option>
            <option value={7}>Senaste 7 dagarna</option>
          </select>
          <label className="ml-1 font-bold text-slate-600" htmlFor="diagnostic-level">Visa</label>
          <select id="diagnostic-level" value={level}
            onChange={event => setLevel(event.target.value as "all" | "error" | "warning")}
            className="border border-slate-300 bg-white px-3 py-2">
            <option value="all">Fel och varningar</option>
            <option value="error">Endast fel</option>
            <option value="warning">Endast varningar</option>
          </select>
        </div>
        <button type="button" onClick={() => void copyText(reportText, "all")}
          disabled={!visibleEntries.length || loading}
          className="inline-flex w-fit border border-slate-950 bg-slate-950 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white hover:bg-slate-800 disabled:opacity-40">
          {copied === "all" ? "Rapport kopierad ✓" : "Kopiera hela felrapporten"}
        </button>
      </div>

      </div>}

      {available && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border border-slate-300 bg-white/40 px-3 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Loggrader</div>
          <div className="mt-1 font-serif text-2xl font-black tabular-nums">{visibleEntries.length}</div>
        </div>
        <div className="border border-slate-300 bg-white/40 px-3 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Fel</div>
          <div className="mt-1 font-serif text-2xl font-black tabular-nums">{visibleEntries.filter(entry => entry.level === "error").length}</div>
        </div>
        <div className="border border-slate-300 bg-white/40 px-3 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Varningar</div>
          <div className="mt-1 font-serif text-2xl font-black tabular-nums">{visibleEntries.filter(entry => entry.level === "warning").length}</div>
        </div>
        <div className="border border-slate-300 bg-white/40 px-3 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Git-commit</div>
          <div className="mt-2 truncate font-mono text-xs">{commit ? commit.slice(0, 10) : "Okänd"}</div>
        </div>
      </div>}

      {message && <div role="status" className="mt-4 border border-amber-600 bg-amber-50 px-3 py-3 text-sm text-amber-950">{message}</div>}
      {!available && !message && (
        <div className="mt-4 border border-amber-600 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          Historisk felloggning i Blob är avstängd för att begränsa Advanced Blob Operations. Använd Vercel Runtime Logs för den faktiska logghistoriken.
        </div>
      )}
      {truncated && <p className="mt-3 text-xs text-amber-800">Rapporten är begränsad till de 80 senaste loggarna för vald period.</p>}

      <div className="mt-4 divide-y divide-slate-200 border-t border-slate-300">
        {loading ? <p className="py-6 text-sm text-slate-500">Läser in felhistoriken…</p> :
          visibleEntries.length === 0 ? (
            <p className="py-6 font-serif text-sm leading-6 text-slate-500">
              {available
                ? "Inga registrerade fel eller varningar under den valda perioden. Alla typer av fel fångas inte automatiskt ännu."
                : "Ingen historisk fellogg visas här eftersom beständig lagring i Blob är avstängd. Det bevisar inte att inga fel har inträffat; använd Vercel Runtime Logs."}
            </p>
          ) : visibleEntries.map(entry => (
            <article key={entry.id} className="py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-2">
                  <span className={"mt-0.5 inline-flex px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] " +
                    (entry.level === "error" ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900")}>
                    {levelLabel(entry.level)}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm">{entry.message}</h3>
                    <p className="mt-1 text-xs text-slate-500">{formatTimestamp(entry.timestamp)} · {entry.component}</p>
                  </div>
                </div>
                <button type="button" onClick={() => void copyText(formatEntry(entry), entry.id)}
                  className="inline-flex w-fit border border-slate-400 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-700 hover:border-slate-950">
                  {copied === entry.id ? "Kopierad ✓" : "Kopiera logg"}
                </button>
              </div>
              {entry.detail && <p className="mt-2 text-sm text-slate-700">{entry.detail}</p>}
              {Object.keys(entry.context).length > 0 && (
                <p className="mt-2 break-words font-mono text-xs text-slate-500">Kontext: {JSON.stringify(entry.context)}</p>
              )}
              {entry.stack && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-bold text-slate-600">Visa tekniska detaljer</summary>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words border border-slate-300 bg-white/50 p-3 font-mono text-[11px] leading-5 text-slate-700">{entry.stack}</pre>
                </details>
              )}
            </article>
          ))}
      </div>
      <div className="mt-4 border-t border-slate-300 pt-3 text-xs leading-5 text-slate-500">
        {lastLoaded ? "Loggar hämtade " + formatTimestamp(lastLoaded) + ". " : ""}
        Applikationsdiagnostik skrivs till Vercel Runtime Logs. Historisk felloggning i Blob är avstängd för att minska Advanced Blob Operations. Byggfel och fel innan applikationskoden startar visas i Vercels separata bygg- och runtime-loggar.
      </div>
    </section>
  );
}
