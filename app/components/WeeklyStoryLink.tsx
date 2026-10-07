"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { markWeeklyRead } from "@/app/actions";

type WeeklyStoryLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function WeeklyStoryLink({ href, children, className }: WeeklyStoryLinkProps) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  function handleClick(
    event: MouseEvent<HTMLAnchorElement>
  ) {
    setHidden(true);

    const title =
      event.currentTarget
        .querySelector("h1,h2,h3")
        ?.textContent
        ?.trim() || "Veckofokus";

    void markWeeklyRead(href).catch(error => {
      console.error("Kunde inte spara lässtatus:", error);
    });

    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "article_click",
        category: "weekfocus",
        articleType: "veckofokus",
        source: "Veckofokus",
        topic: title,
        title,
        link: href,
      }),
      keepalive: true,
    }).catch(() => {});

    window.open(href, "_blank", "noopener,noreferrer");
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