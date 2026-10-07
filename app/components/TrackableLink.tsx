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
  children: ReactNode;
  className?: string;
};

export function TrackableLink({
  href,
  category,
  articleType,
  source,
  topic,
  children,
  className,
}: TrackableLinkProps) {
  function handleClick(
    _event: MouseEvent<HTMLAnchorElement>
  ) {
    window.dispatchEvent(new Event("glenn-reader-click"));

    void fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "article_click",
        category,
        articleType,
        source,
        topic,
      }),
      keepalive: true,
    }).catch(() => {
      // Tracking is intentionally best-effort.
    });
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
