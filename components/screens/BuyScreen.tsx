"use client";

import { useMemo, useState } from "react";
import { Loading, useApp } from "@/components/AppProvider";
import { DrinkRow } from "@/components/ui/DrinkRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { RankRow } from "@/components/ui/RankRow";
import { useLanding } from "@/lib/landing";
import { drinkHref, drinkRef, ingredientLine, suggestionName } from "@/lib/present";

/** How many suggestions the screen lists. */
const SHOWN = 30;

export function BuyScreen() {
  const app = useApp();
  const [open, setOpen] = useState<string | null>(null);
  useLanding();

  // how often the books name each bottle; depends only on the recipes
  const allRecipes = app?.allRecipes;
  const named = useMemo(() => {
    const out = new Map<string, number>();
    for (const r of allRecipes ?? []) for (const i of r.ingredients) for (const b of i.bottles ?? []) out.set(b, (out.get(b) ?? 0) + 1);
    return out;
  }, [allRecipes]);

  // one real bottle per suggestion that would count, so a style reads as something to buy:
  // the one the books name most often, so the example is a bottle bartenders actually use
  const examples = useMemo(() => {
    const out = new Map<string, string>();
    if (!app) return out;
    for (const s of app.suggestions.slice(0, SHOWN)) {
      const fits = app.core.bottles.filter((b) => {
        const covers = app.catalog.covers(b.nodes);
        return s.nodes.every((n) => covers.has(n));
      });
      const pick = fits.sort((a, b) => (named.get(b.id) ?? 0) - (named.get(a.id) ?? 0) || a.name.length - b.name.length)[0];
      if (pick) out.set(s.nodes.join("&"), pick.name);
    }
    return out;
  }, [app, named]);

  if (!app) return <Loading />;
  const { catalog, bookShort } = app;
  const suggestions = app.suggestions.slice(0, SHOWN);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Buy Next"
        intro="Bottles ranked by how many drinks each one finishes for you. Swaps are already counted."
      />
      {suggestions.length === 0 ? (
        <p className="body text-muted">Every drink in your books is either makeable or more than one bottle away.</p>
      ) : (
        <div>
          <div className="ci-colhead label">
            <span>BOTTLE</span>
            <span>NEW DRINKS</span>
          </div>
          <ol className="ci-list">
            {suggestions.map((s, i) => {
              const key = s.nodes.join("&");
              return (
                <RankRow
                  key={key}
                  rank={i + 1}
                  name={suggestionName(catalog, s, examples.get(key))}
                  examples={s.unlocks.slice(0, 2).map((r) => drinkRef(r, bookShort)).join(", ")}
                  adds={s.unlocks.length}
                  action={s.action}
                  onHave={() => app.setOwned(key, true)}
                  open={open === key}
                  onOpen={() => setOpen(open === key ? null : key)}
                >
                  <ul className="ci-list">
                    {s.unlocks.map((r) => (
                      <DrinkRow
                        key={r.id}
                        href={drinkHref(r.id, "buy")}
                        name={r.name}
                        book={bookShort(r.book)}
                        page={r.page}
                        ingredients={ingredientLine(catalog, r)}
                      />
                    ))}
                  </ul>
                </RankRow>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
