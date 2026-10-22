"use client";

import { Loading, useApp } from "@/components/AppProvider";
import { BookRow } from "@/components/ui/BookRow";
import { GroupHeader } from "@/components/ui/GroupHeader";
import { PageHeader } from "@/components/ui/PageHeader";
import { ASSUMABLE_FLAGS, type AssumableFlag } from "@/lib/engine/types";
import { useLanding } from "@/lib/landing";

/** Shorten authors to surnames when there are more than two. */
function authorLine(author: string): string {
  const people = author.split(/,\s*|\s+&\s+|\s+and\s+/).filter(Boolean);
  return people.length > 2 ? people.map((p) => p.trim().split(/\s+/).pop()).join(", ") : author;
}

/** The BookRow list with its column heading, shared by Books and the Drinks book filter. */
export function BookList() {
  const app = useApp();
  if (!app) return null;
  const { core, allResults, ownedBooks, update } = app;
  const canMake = new Map<string, number>();
  for (const r of allResults) if (r.status !== "missing") canMake.set(r.recipe.book, (canMake.get(r.recipe.book) ?? 0) + 1);
  const books = [...core.books].sort((a, b) => (canMake.get(b.id) ?? 0) - (canMake.get(a.id) ?? 0) || a.title.localeCompare(b.title));

  const toggle = (id: string) =>
    update((s) => {
      const next = new Set(s.books ?? core.books.map((b) => b.id));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...s, books: next.size === core.books.length ? null : [...next] };
    });

  return (
    <div>
      <div className="ci-colhead label">
        <span className="pl-8">BOOK</span>
        <span>CAN MAKE / INDEXED</span>
      </div>
      <ul className="ci-list">
        {books.map((b) => (
          <BookRow
            key={b.id}
            title={b.title}
            author={authorLine(b.author)}
            year={b.year}
            canMake={canMake.get(b.id) ?? 0}
            indexed={b.recipeCount}
            owned={ownedBooks.has(b.id)}
            onToggle={() => toggle(b.id)}
          />
        ))}
      </ul>
    </div>
  );
}

const ASSUME_TEXT: Record<AssumableFlag, { name: string; hint: string }> = {
  fresh: { name: "Fresh produce", hint: "Citrus, juices, fruit and herbs" },
  housemade: { name: "Housemade syrups", hint: "Syrups, tinctures and shrubs the book gives a recipe for" },
  staple: { name: "Pantry staples", hint: "Water, sugar, salt, simple syrup, soda water" },
  garnish: { name: "Garnishes", hint: "Twists, wheels, cherries" },
};

export function BooksScreen() {
  const app = useApp();
  useLanding();
  if (!app) return <Loading />;
  const { core, ownedBooks, state, update } = app;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Books"
        meta={`${ownedBooks.size} OF ${core.books.length} OWNED`}
        intro="Tick the books on your shelf. Drinks and Buy Next only count recipes from these."
      />
      <BookList />

      <section className="mt-2">
        <GroupHeader name="Assume on hand" meta="NEVER COUNTED AS MISSING" />
        {ASSUMABLE_FLAGS.map((f) => (
          <label key={f} className="ci-check" data-owned={state.assumptions[f] ? "true" : undefined}>
            <input
              type="checkbox"
              checked={state.assumptions[f]}
              onChange={(e) => update((s) => ({ ...s, assumptions: { ...s.assumptions, [f]: e.target.checked } }))}
            />
            <span className="ci-check-text">
              <span className="ci-check-name">{ASSUME_TEXT[f].name}</span>
              <span className="ci-check-hint">{ASSUME_TEXT[f].hint}</span>
            </span>
          </label>
        ))}
      </section>

      <div className="caption mt-2 flex flex-col gap-1 text-muted">
        <p>
          Indexes from the r/cocktails community; built on{" "}
          <a className="underline" href="https://github.com/thomaswford/pdt-index">
            pdt-index
          </a>{" "}
          by Thomas Ford.
        </p>
        <p>Not affiliated with any book, author, publisher or bar.</p>
      </div>
    </div>
  );
}
