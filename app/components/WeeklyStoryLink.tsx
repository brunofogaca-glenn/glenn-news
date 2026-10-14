"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { markWeeklyRead } from "@/app/actions";

type WeeklyStoryLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  category?: string;
  articleType?: string;
  source?: string;
  topic?: string;
  summary?: string;
};

export function WeeklyStoryLink({
  href,
  children,
  className,
  category = "weekfocus",
  articleType = "veckofokus",
  source = "Veckofokus",
  topic,
  summary,
}: WeeklyStoryLinkProps) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    setHidden(true);

    const title =
      event.currentTarget
        .querySelector("h1,h2,h3")
        ?.textContent
        ?.trim() || topic || "Veckofokus";

    void markWeeklyRead(href).catch(error => {
      console.error("Kunde inte spara lässtatus:", error);
    });

    // Match TrackableLink's event contract so the click endpoint can persist
    // and classify this story. Retry the same ID only on transient failure.
    const eventId = `${Date.now()}-${window.crypto.randomUUID().replaceAll("-", "")}`;
    const payload = JSON.stringify({
      type: "article_click",
      eventId,
      category,
      articleType,
      source,
      topic: topic ?? title,
      title,
      summary: summary?.trim().slice(0, 1_200),
      link: href,
    });
    void sendClickEvent(payload);

    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function sendClickEvent(payload: string) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
          cache: "no-store",
          credentials: "same-origin",
        });
        const result = await response.json().catch(() => null) as
          | { ok?: boolean }
          | null;

        if (response.ok && result?.ok === true) return;
        if (response.status < 500 || attempt === 1) {
          console.warn("Veckofokus-klicket kunde inte sparas.", {
            status: response.status,
            responseOk: response.ok,
          });
          return;
        }
      } catch (error) {
        if (attempt === 1) {
          console.warn("Veckofokus-klicket nådde inte loggningen.", error);
          return;
        }
      }
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={event => {
        event.preventDefault();
        handleClick(event);
      }}
      className={className}
    >
      {children}
    </a>
  );
}
