"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loading, useApp } from "@/components/AppProvider";
import { Button } from "@/components/ui/Button";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { IngredientRow } from "@/components/ui/IngredientRow";
import { SourceBox } from "@/components/ui/SourceBox";
import { SwapBadge } from "@/components/ui/SwapBadge";
import { Catalog, evaluate } from "@/lib/engine/engine";
import { useLanding } from "@/lib/landing";
import { drinkHref, ingredientDetail, markState, missingNames, requirementName, sortKey } from "@/lib/present";

const BACK = { buy: { label: "Buy Next", href: "/buy" }, drinks: { label: "Drinks", href: "/" } } as const;

export function DrinkScreen({ id }: { id: string }) {
  const app = useApp();
  const from = useSearchParams().get("from") === "buy" ? BACK.buy : BACK.drinks;
  useLanding();

  const back = (
    <Link href={from.href} className="secondary -ml-1 inline-flex min-h-[var(--size-touch)] items-center gap-1 text-ink no-underline">
      <ChevronLeftIcon />
      {from.label}
    </Link>
  );
  if (!app) return <Loading />;

  const recipe = app.allRecipes.find((r) => r.id === id);
  if (!recipe) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p className="body text-muted">That drink isn&apos;t in the index.</p>
      </div>
    );
  }

  const { catalog, core, items, state, itemName, suggestions, ownedBooks, bookShort } = app;
  // a shared link can point at a book you don't own, so evaluate this recipe on its own
  const [result] = evaluate(new Catalog(core, [recipe]), items, state.assumptions);
  // a source added without its books.csv row still renders, named by its id
  const book = core.books.find((b) => b.id === recipe.book) ?? { title: recipe.book, author: "Unknown author", year: "None" };
  const alsoIn = app.allRecipes
    .filter((r) => r.id !== recipe.id && ownedBooks.has(r.book) && sortKey(r.name) === sortKey(recipe.name))
    .map((r) => ({ book: core.books.find((b) => b.id === r.book)?.title ?? r.book, page: r.page, href: drinkHref(r.id) }));

  const swaps = result.ingredients.filter((i) => i.status.kind === "substitute").length;
  const missing = missingNames(catalog, result);
  const addsFor = (nodes: string[]) => suggestions.find((s) => s.nodes.join("&") === nodes.join("&"))?.unlocks.length;
  const firstMissing = result.missing.find((m) => !m.anyOf.some((n) => catalog.node(n).flags.includes("batch")));

  return (
    <article className="flex flex-col gap-4">
      {back}
      <div className="flex flex-col gap-2">
        <h1 className="title-drink">{recipe.name}</h1>
        {result.status === "substitute" && (
          <p className="ci-row-swap body">
            <SwapBadge />
            {swaps === 1 ? "You can make this with one swap" : `You can make this with ${swaps} swaps`}
          </p>
        )}
        {missing.length === 1 && <p className="body font-semibold text-brass">Missing 1: {missing[0]}</p>}
        {missing.length > 1 && <p className="body font-semibold text-brass">Missing {missing.length}</p>}
      </div>

      <SourceBox book={{ title: book.title, author: book.author, year: book.year }} page={recipe.page} alsoIn={alsoIn} />

      <div>
        <div className="ci-colhead label">
          <span>INGREDIENTS · {recipe.ingredients.length}</span>
          <span>FROM YOUR BAR</span>
        </div>
        <ul className="ci-list">
          {result.ingredients.map(({ ingredient, status }, i) => (
            <IngredientRow
              key={i}
              state={markState(status)}
              name={requirementName(catalog, ingredient)}
              detail={ingredientDetail(
                catalog,
                ingredient,
                status,
                itemName,
                status.kind === "missing" ? addsFor([ingredient.anyOf[0], ...(ingredient.with ?? [])]) : undefined,
              )}
            />
          ))}
        </ul>
      </div>

      {firstMissing && (
        <div className="flex justify-end gap-2">
          <Button variant="primary" onClick={() => app.setOwned([firstMissing.anyOf[0], ...(firstMissing.with ?? [])].join("&"), true)}>
            I have it
          </Button>
        </div>
      )}
      {!ownedBooks.has(recipe.book) && (
        <p className="caption text-muted">{bookShort(recipe.book)} isn&apos;t ticked on Books, so this drink doesn&apos;t count toward your totals.</p>
      )}
    </article>
  );
}
