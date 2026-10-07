"use client";

import { useEffect, useState } from "react";

export function ReaderCount({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const onReaderClick = () => setCount(value => value + 1);
    window.addEventListener("glenn-reader-click", onReaderClick);
    return () =>
      window.removeEventListener("glenn-reader-click", onReaderClick);
  }, []);

  return <>{count}</>;
}
