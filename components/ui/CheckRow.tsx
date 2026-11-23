"use client";

/**
 * One bottle or style in the My Bar checklist. `covered` (a bottle you own that already
 * satisfies this entry) shows it checked and disabled, with the reason in brass.
 */
export function CheckRow({
  name,
  count,
  checked,
  covered,
  hint,
  onToggle,
}: {
  name: string;
  count: number;
  checked: boolean;
  covered?: string;
  hint?: string;
  onToggle: () => void;
}) {
  return (
    <label className="ci-check" data-owned={checked && !covered ? "true" : undefined}>
      <input type="checkbox" checked={checked || !!covered} disabled={!!covered} onChange={onToggle} />
      <span className="ci-check-text">
        <span className="ci-check-name">{name}</span>
        {covered && <span className="ci-check-hint ci-check-hint-covered">Covered by your {covered}</span>}
        {!covered && hint && <span className="ci-check-hint">{hint}</span>}
      </span>
      <span className="ci-check-count">{count}</span>
    </label>
  );
}
