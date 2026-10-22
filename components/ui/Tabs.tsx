"use client";

import type { CSSProperties } from "react";

export function Tabs({
  variant,
  label,
  tabs,
  selected,
  onSelect,
}: {
  variant: "fill" | "inline";
  label: string;
  tabs: { id: string; label: string; count: number }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className={`ci-tabs ci-tabs-${variant}`}
      role="tablist"
      aria-label={label}
      style={variant === "fill" ? ({ "--ci-tab-count": tabs.length } as CSSProperties) : undefined}
    >
      {tabs.map((t) => (
        <button key={t.id} type="button" className="ci-tab" role="tab" aria-selected={t.id === selected} onClick={() => onSelect(t.id)}>
          {t.label}
          <span className="ci-tab-count">{t.count.toLocaleString("en-US")}</span>
        </button>
      ))}
    </div>
  );
}
