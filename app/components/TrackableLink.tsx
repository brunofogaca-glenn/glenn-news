"use client";

import type {
  MouseEvent,
  ReactNode,
} from "react";

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
  function handleClick(
    event: MouseEvent<HTMLAnchorElement>
  ) {
    window.dispatchEvent(new Event("glenn-reader-click"));

    const title =
      event.currentTarget
        .querySelector("h1,h2,h3")
        ?.textContent
        ?.trim() ||
      event.currentTarget.textContent
        ?.replace(/\s+/g, " ")
        .trim()
        .slice(0, 300);

    // A stable ID lets the endpoint retry one failed write without counting
    // the same user click twice if the first response was lost.
    const id = `${Date.now()}-${window.crypto.randomUUID().replaceAll("-", "")}`;
    const payload = JSON.stringify({
      type: "article_click",
      eventId: id,
      category,
      articleType,
      source,
      topic,
      title,
      summary: summary?.trim().slice(0, 1_200),
      link: href,
    });

    void sendClickEvent(payload);
  }

  async function sendClickEvent(payload: string) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch("/api/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: payload,
          keepalive: true,
          cache: "no-store",
          credentials: "same-origin",
        });

        const result = await response.json().catch(() => null) as
          | { ok?: boolean }
          | null;

        if (response.ok && result?.ok === true) {
          return;
        }

        // Only retry transient server failures. Bad event data should not retry.
        if (response.status < 500 || attempt === 1) {
          console.warn("Reader click was not saved.", {
            status: response.status,
            responseOk: response.ok,
          });
          return;
        }
      } catch (error) {
        if (attempt === 1) {
          console.warn("Reader click could not reach the tracking endpoint.", error);
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
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}
