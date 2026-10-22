"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

/**
 * One suggestion on Buy Next. Tapping the name opens the drinks it adds (`children`,
 * shown under the row when `open`).
 */
export function RankRow({
  rank,
  name,
  examples,
  adds,
  action,
  onHave,
  open,
  onOpen,
  children,
}: {
  rank: number;
  name: string;
  examples: string;
  adds: number;
  action: "buy" | "make";
  onHave: () => void;
  open?: boolean;
  onOpen?: () => void;
  children?: ReactNode;
}) {
  return (
    <li className="ci-rank">
      <span className="ci-rank-n">{String(rank).padStart(2, "0")}</span>
      <button type="button" className="ci-rank-open" aria-expanded={open} onClick={onOpen}>
        <span className="item">{name}</span>
        <span className="caption text-muted">{examples}</span>
      </button>
      <span className="ci-rank-side">
        <span className="stat">+{adds}</span>
        <Button variant="secondary" compact onClick={onHave}>
          {action === "make" ? "Make it" : "Have it"}
        </Button>
      </span>
      {open && children && <div className="ci-rank-drinks">{children}</div>}
    </li>
  );
}
