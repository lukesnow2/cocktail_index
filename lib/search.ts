import type { Bottle } from "./engine/types";
import { fold } from "./text";

// Words people type that labels spell differently or omit ("12 yr", "10 yo").
const FILLER = new Set(["yr", "yrs", "year", "years", "yo", "old", "the"]);

const tokens = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

export interface BottleMatch {
  bottle: Bottle;
  /** Every typed word matched; false means only some did ("similar bottles"). */
  exact: boolean;
}

/**
 * Find bottles by name or alias. Each typed word must be the start of a word on the
 * label, so "appleton 12" finds "Appleton Estate 12 Year Rare Casks" but "appleton 30"
 * finds nothing exact. In that case we fall back to bottles matching the first word,
 * marked inexact, and never pick one on the user's behalf.
 */
export function searchBottles(bottles: Bottle[], query: string, limit = 8): BottleMatch[] {
  const typed = tokens(query);
  // skip filler ("12 yr") only when other words remain, so "Old" still finds Old Forester
  const meaningful = typed.filter((t) => !FILLER.has(t));
  const q = meaningful.length ? meaningful : typed;
  if (!q.length) return [];
  const labels = (b: Bottle) => [b.name, ...b.aliases].map(tokens);
  const matchesAll = (label: string[]) => q.every((t) => label.some((w) => w.startsWith(t)));

  const exact = bottles.filter((b) => labels(b).some(matchesAll));
  if (exact.length) {
    return exact
      .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((bottle) => ({ bottle, exact: true }));
  }
  return bottles
    .filter((b) => labels(b).some((label) => label.some((w) => w.startsWith(q[0]))))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((bottle) => ({ bottle, exact: false }));
}
