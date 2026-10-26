"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { enqueueReaderEvent } from "./readerQueue";

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

function makeEventId() {
  return `${Date.now()}-${window.crypto.randomUUID().replaceAll("-", "")}`;
}

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
    event.preventDefault();
    setHidden(true);

    const title =
      event.currentTarget.querySelector("h1,h2,h3")?.textContent?.trim() ||
      topic ||
      "Veckofokus";

    // Queue in the browser, like the home-page links. No per-click Blob writes,
    // API calls, or AI classification run while the reader is browsing.
    try {
      const url = new URL(href, window.location.href);
      if ((url.protocol === "http:" || url.protocol === "https:") &&
          url.origin !== window.location.origin) {
        enqueueReaderEvent({
          eventId: makeEventId(),
          timestamp: new Date().toISOString(),
          category,
          articleType,
          source,
          topic: topic ?? title,
          title,
          summary: summary?.trim().slice(0, 1_200),
          link: url.toString(),
        });
      }
    } catch (error) {
      console.warn("Kunde inte lägga Veckofokus-artikeln i läskön.", error);
    }

    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}
