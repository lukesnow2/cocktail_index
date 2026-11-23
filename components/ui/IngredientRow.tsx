import { StatusMark, type MarkState } from "./StatusMark";

const WORD: Record<MarkState, string> = { have: "HAVE", swap: "SWAP", missing: "MISSING" };

/** One ingredient on a drink page: mark, name as the book lists it, one line of detail, the state word. */
export function IngredientRow({ state, name, detail }: { state: MarkState; name: string; detail: string }) {
  return (
    <li className="ci-ing">
      <StatusMark state={state} />
      <span className="ci-ing-text">
        <span className="item">{name}</span>
        {detail && <span className="ci-ing-detail secondary">{detail}</span>}
      </span>
      <span className={`ci-ing-status${state === "missing" ? " ci-ing-status-missing" : ""}`}>{WORD[state]}</span>
    </li>
  );
}
