/** A letter header in an A to Z list (hidden from screen readers), or a named section header. */
export function GroupHeader(props: { letter: string; id?: string } | { name: string; meta?: string }) {
  if ("letter" in props) {
    return (
      <div className="ci-group" aria-hidden="true" id={props.id}>
        <span className="ci-group-letter">{props.letter}</span>
      </div>
    );
  }
  return (
    <div className="ci-group">
      <span className="ci-group-name">{props.name}</span>
      {props.meta && <span className="ci-group-meta">{props.meta}</span>}
    </div>
  );
}
