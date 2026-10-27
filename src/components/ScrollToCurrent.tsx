"use client";

import { useEffect, useRef } from "react";

/** 横スクロールする表で、data-current の列が見えるように最初にスクロールしておく */
export function ScrollToCurrent({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    const cell = box?.querySelector<HTMLElement>("[data-current]");
    if (!box || !cell) return;
    const sticky = box.querySelector<HTMLElement>("th")?.offsetWidth ?? 0;
    const target = cell.offsetLeft - sticky - (box.clientWidth - sticky - cell.offsetWidth) / 2;
    box.scrollLeft = Math.max(0, target);
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
