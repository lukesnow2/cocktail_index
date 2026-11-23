"use client";

export const RAIL_LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/** The A to Z rail beside a long alphabetical list. `letters` are the enabled ones. */
export function IndexRail({ letters, onJump }: { letters: string[]; onJump: (letter: string) => void }) {
  const enabled = new Set(letters);
  return (
    <nav className="ci-rail" aria-label="Jump to letter">
      {RAIL_LETTERS.map((l) => (
        <a
          key={l}
          href={`#letter-${l}`}
          aria-disabled={enabled.has(l) ? undefined : "true"}
          onClick={(e) => {
            e.preventDefault();
            if (enabled.has(l)) onJump(l);
          }}
        >
          {l}
        </a>
      ))}
    </nav>
  );
}
