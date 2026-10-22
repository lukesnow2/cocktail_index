"use client";

export function BookRow({
  title,
  author,
  year,
  canMake,
  indexed,
  owned,
  onToggle,
}: {
  title: string;
  author: string;
  year: string;
  canMake: number;
  indexed: number;
  owned: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="ci-book">
        <input type="checkbox" checked={owned} onChange={onToggle} />
        <span className="ci-book-text">
          <span className="item">{title}</span>
          <span className="caption text-muted">
            {author}, {year}
          </span>
        </span>
        <span className="ci-book-count">
          {canMake}
          <span> / {indexed}</span>
        </span>
      </label>
    </li>
  );
}
