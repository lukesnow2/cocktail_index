"use client";

import { useRouter } from "next/navigation";
import { Fragment, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Loading, useApp } from "@/components/AppProvider";
import { BookSheet } from "@/components/screens/BookSheet";
import { Button } from "@/components/ui/Button";
import { DrinkRow } from "@/components/ui/DrinkRow";
import { GroupHeader } from "@/components/ui/GroupHeader";
import { ChevronDownIcon } from "@/components/ui/icons";
import { IndexRail } from "@/components/ui/IndexRail";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchField } from "@/components/ui/SearchField";
import { Tabs } from "@/components/ui/Tabs";
import { useLanding } from "@/lib/landing";
import { drinkHref, indexLetter, ingredientLine, missingNames, requirementName, sortKey, swapPhrase } from "@/lib/present";
import { fold } from "@/lib/text";

type Filter = "make" | "one" | "all";

export function DrinksScreen() {
  const app = useApp();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("make");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState(false);
  // filtering 1,425 rows can trail the keyboard; the field itself stays instant
  const deferredQuery = useDeferredValue(query);

  // First run opens on My Bar (an empty Drinks list says nothing useful), but only when
  // the app opened here
  const landingRef = useLanding();
  useEffect(() => {
    if (!app || !landingRef.current) return;
    landingRef.current = false;
    if (app.items.length === 0) router.replace("/bar");
  }, [app, router, landingRef]);

  // what each drink can be found by, and its ingredient line: both depend only on the
  // catalog, so they're built once per catalog rather than on every keystroke
  const catalog = app?.catalog;
  const index = useMemo(() => {
    const out = new Map<string, { haystack: string; line: string[]; sort: string }>();
    if (!catalog) return out;
    for (const r of catalog.recipes) {
      const words = [r.name, ...r.ingredients.flatMap((i) => [requirementName(catalog, i), i.note ?? ""])];
      out.set(r.id, { haystack: fold(words.join(" \u0000 ")), line: ingredientLine(catalog, r), sort: sortKey(r.name) });
    }
    return out;
  }, [catalog]);

  const list = useMemo(() => {
    if (!app) return [];
    const q = fold(deferredQuery.trim());
    return app.results
      .filter((r) => (filter === "make" ? r.status !== "missing" : filter === "one" ? r.missing.length === 1 : true))
      .filter((r) => !q || index.get(r.recipe.id)!.haystack.includes(q))
      .sort((a, b) => index.get(a.recipe.id)!.sort.localeCompare(index.get(b.recipe.id)!.sort) || a.recipe.book.localeCompare(b.recipe.book));
  }, [app, filter, deferredQuery, index]);

  if (!app || !catalog) return <Loading />;
  const { results, core, ownedBooks, bookShort } = app;
  const counts = {
    make: results.filter((r) => r.status !== "missing").length,
    one: results.filter((r) => r.missing.length === 1).length,
    all: results.length,
  };
  const letters = [...new Set(list.map((r) => indexLetter(r.recipe.name)))];
  const bookLabel = ownedBooks.size === core.books.length ? `ALL ${core.books.length} BOOKS` : `${ownedBooks.size} ${ownedBooks.size === 1 ? "BOOK" : "BOOKS"}`;

  let empty: React.ReactNode = null;
  if (ownedBooks.size === 0) empty = <p className="body text-muted">Tick at least one book to see drinks.</p>;
  else if (app.items.length === 0)
    empty = (
      <div className="flex flex-col items-start gap-4">
        <p className="body text-muted">Add a few bottles to see what you can make.</p>
        <Button variant="primary" onClick={() => router.push("/bar")}>
          Go to My Bar
        </Button>
      </div>
    );
  else if (query.trim() && !list.length) empty = <p className="body text-muted">No drinks match &quot;{query.trim()}&quot; in your books.</p>;
  else if (filter === "make" && counts.make === 0)
    empty = (
      <div className="flex flex-col items-start gap-4">
        <p className="body text-muted">Nothing yet. Buy Next shows which bottle adds the most drinks.</p>
        <Button variant="secondary" onClick={() => router.push("/buy")}>
          See Buy Next
        </Button>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Drinks"
        action={
          <Button variant="secondary" compact className="ci-btn-mono" aria-haspopup="dialog" onClick={() => setSheet(true)}>
            {bookLabel}
            <ChevronDownIcon />
          </Button>
        }
      />
      <SearchField label="Search drinks" placeholder="Drink, ingredient or bottle" value={query} onChange={setQuery} />
      <Tabs
        variant="fill"
        label="Filter"
        selected={filter}
        onSelect={(id) => setFilter(id as Filter)}
        tabs={[
          { id: "make", label: "Can make", count: counts.make },
          { id: "one", label: "One away", count: counts.one },
          { id: "all", label: "All", count: counts.all },
        ]}
      />
      {empty ?? (
        <div className="flex gap-2">
          <ul className="ci-list min-w-0 flex-1">
            {list.map((r, i) => {
              const letter = indexLetter(r.recipe.name);
              const startsGroup = i === 0 || indexLetter(list[i - 1].recipe.name) !== letter;
              return (
                <Fragment key={r.recipe.id}>
                  {startsGroup && (
                    <li>
                      <GroupHeader letter={letter} id={`letter-${letter}`} />
                    </li>
                  )}
                  <DrinkRow
                    href={drinkHref(r.recipe.id)}
                    name={r.recipe.name}
                    book={bookShort(r.recipe.book)}
                    page={r.recipe.page}
                    ingredients={index.get(r.recipe.id)!.line}
                    swap={r.status === "substitute" ? swapPhrase(catalog, r) : undefined}
                    missing={filter === "one" || (filter === "all" && r.missing.length === 1) ? missingNames(catalog, r)[0] : undefined}
                  />
                </Fragment>
              );
            })}
          </ul>
          {list.length > 12 && (
            <div className="sticky top-4 self-start">
              <IndexRail letters={letters} onJump={(l) => document.getElementById(`letter-${l}`)?.scrollIntoView({ block: "start" })} />
            </div>
          )}
        </div>
      )}
      {sheet && <BookSheet onClose={() => setSheet(false)} />}
    </div>
  );
}
