export type MarkState = "have" | "swap" | "missing";

/** The 10px state square. Always paired with its word in the same row. */
export function StatusMark({ state }: { state: MarkState }) {
  return <span className={`ci-mark ci-mark-${state}`} aria-hidden="true" />;
}
