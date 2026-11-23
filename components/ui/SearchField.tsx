"use client";

import type { ReactNode } from "react";
import { CloseIcon, SearchIcon } from "./icons";

/** A square search field; `results` opens a panel under it that pushes the list down. */
export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  results,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  results?: ReactNode;
}) {
  return (
    <div className="ci-search">
      <label className="ci-search-field">
        <SearchIcon />
        <span className="ci-sr">{label}</span>
        <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        {value && (
          <button type="button" className="ci-search-clear" aria-label="Clear search" onClick={() => onChange("")}>
            <CloseIcon />
          </button>
        )}
      </label>
      {results}
    </div>
  );
}
