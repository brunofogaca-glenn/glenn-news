"use client";

import type {
  MouseEvent,
  ReactNode,
} from "react";
import { enqueueReaderEvent } from "./readerQueue";

type TrackableLinkProps = {
  href: string;
  category: string;
  articleType: string;
  source: string;
  topic?: string;
  summary?: string;
  children: ReactNode;
  className?: string;
};

export function TrackableLink({
  href,
  category,
  articleType,
  source,
  topic,
  summary,
  children,
  className,
}: TrackableLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    let url: URL;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }
    // Only external article links count as reads; internal navigation is excluded.
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.origin === window.location.origin) return;

    window.dispatchEvent(new Event("glenn-reader-click"));
    const title = event.currentTarget.querySelector("h1,h2,h3")?.textContent?.trim()
      || event.currentTarget.textContent?.replace(/\\s+/g, " ").trim().slice(0, 300);
    try {
      enqueueReaderEvent({
        eventId: `${Date.now()}-${window.crypto.randomUUID().replaceAll("-", "")}`,
        timestamp: new Date().toISOString(),
        category, articleType, source, topic, title,
        summary: summary?.trim().slice(0, 1200),
        link: url.toString(),
      });
    } catch (error) {
      console.warn("Kunde inte lägga artikeln i läskön.", error);
    }
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
