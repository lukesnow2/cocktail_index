"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { buyNext, Catalog, evaluate, usage, type OwnedItem, type RecipeResult, type Suggestion } from "@/lib/engine/engine";
import type { Bottle, CoreCatalog, NodeId, Recipe } from "@/lib/engine/types";
import { useCatalog } from "@/lib/useCatalog";
import { useUserState, type UserState } from "@/lib/store";
import { itemLabel, slug } from "@/lib/text";

export interface AppState {
  core: CoreCatalog;
  /** Every indexed recipe, whatever books the user owns (drink pages, Books counts). */
  allRecipes: Recipe[];
  /** Recipes from the user's books only. */
  catalog: Catalog;
  /** Every recipe evaluated, for per-book counts on Books. */
  allResults: RecipeResult[];
  results: RecipeResult[];
  /** Every buy-next suggestion, best first (screens show as many as they need). */
  suggestions: Suggestion[];
  usage: Map<NodeId, number>;
  state: UserState;
  update: (change: (s: UserState) => UserState) => void;
  items: OwnedItem[];
  myBottles: Bottle[];
  /** Categories (or "a&b" combinations) ticked on their own, unknown ids dropped. */
  myOwned: string[];
  itemName: (key: string) => string;
  /** "PDT", "D&C": a book's short name for references. */
  bookShort: (id: string) => string;
  setOwned: (id: string, has: boolean) => void;
  setBottle: (id: string, has: boolean) => void;
  ownedBooks: Set<string>;
}

const Ctx = createContext<{ app: AppState | null; error: string | null }>({ app: null, error: null });

export function AppProvider({ children }: { children: ReactNode }) {
  const { data, error } = useCatalog();
  const [state, update] = useUserState();

  const bottleById = useMemo(() => new Map((data?.core.bottles ?? []).map((b) => [b.id, b])), [data]);
  const knownNodes = useMemo(() => new Set((data?.core.taxonomy ?? []).map((n) => n.id)), [data]);

  // drop saved ids this catalog no longer has, and follow renamed bottles through their
  // old names (Plantation -> Planteray), so nothing lingers invisibly in the bar
  useEffect(() => {
    if (!data) return;
    const byAlias = new Map(data.core.bottles.flatMap((b) => b.aliases.map((a) => [slug(a), b.id] as const)));
    update((s) => {
      const owned = s.owned.filter((o) => o.split("&").every((n) => knownNodes.has(n)));
      const bottles = [...new Set(s.bottles.map((id) => (bottleById.has(id) ? id : byAlias.get(id))).filter((id): id is string => !!id))];
      const same = owned.length === s.owned.length && bottles.length === s.bottles.length && bottles.every((b, i) => b === s.bottles[i]);
      return same ? s : { ...s, owned, bottles };
    });
  }, [data, bottleById, knownNodes, update]);

  // the catalogs (and their ancestor / cover caches) and usage depend only on the data and
  // which books are ticked, so they survive every bottle tick
  const booksKey = state.books?.join("|") ?? "*";
  const base = useMemo(() => {
    if (!data) return null;
    const ownedBooks = new Set(booksKey === "*" ? data.core.books.map((b) => b.id) : booksKey.split("|").filter(Boolean));
    const catalog = new Catalog(data.core, data.recipes.filter((r) => ownedBooks.has(r.book)));
    const short = new Map(data.core.books.map((b) => [b.id, b.short]));
    return {
      ownedBooks,
      catalog,
      allCatalog: new Catalog(data.core, data.recipes),
      usage: usage(catalog),
      bookShort: (id: string) => short.get(id) ?? id,
    };
  }, [data, booksKey]);

  const app = useMemo<AppState | null>(() => {
    if (!data || !base) return null;
    const { catalog, allCatalog } = base;
    // saved ids this catalog doesn't know are skipped here, during render, so an old id
    // can never reach a lookup that throws
    const myOwned = state.owned.filter((o) => o.split("&").every((n) => knownNodes.has(n)));
    const myBottles = state.bottles.map((id) => bottleById.get(id)).filter((b): b is Bottle => !!b);
    const items: OwnedItem[] = [
      ...myOwned.map((s) => ({ key: `n:${s}`, nodes: s.split("&") })),
      ...myBottles.map((b) => ({ key: `b:${b.id}`, nodes: b.nodes, bottle: b.id })),
    ];
    const names = new Map<string, string>();
    for (const s of myOwned) names.set(`n:${s}`, itemLabel(catalog, s.split("&")));
    for (const b of myBottles) names.set(`b:${b.id}`, b.name);
    const results = evaluate(catalog, items, state.assumptions);
    return {
      core: data.core,
      allRecipes: data.recipes,
      catalog,
      allResults: evaluate(allCatalog, items, state.assumptions),
      results,
      suggestions: buyNext(catalog, results, Infinity),
      usage: base.usage,
      state,
      update,
      items,
      myBottles,
      myOwned,
      itemName: (key) => names.get(key) ?? key,
      bookShort: base.bookShort,
      // only ever the exact item: bottles and combinations are removed where they're listed
      setOwned: (id, has) =>
        update((s) => (has ? { ...s, owned: [...new Set([...s.owned, id])] } : { ...s, owned: s.owned.filter((o) => o !== id) })),
      setBottle: (id, has) =>
        update((s) => ({ ...s, bottles: has ? [...new Set([...s.bottles, id])] : s.bottles.filter((b) => b !== id) })),
      ownedBooks: base.ownedBooks,
    };
  }, [data, base, state, update, knownNodes, bottleById]);

  return <Ctx.Provider value={{ app, error }}>{children}</Ctx.Provider>;
}

/** The app state, or null while the catalog loads. */
export function useApp(): AppState | null {
  return useContext(Ctx).app;
}

/** Loading and error states every screen shows the same way. */
export function Loading() {
  const { error } = useContext(Ctx);
  return (
    <p className="body text-muted">
      {error ? `Couldn't load the recipe index (${error}). Reload to try again.` : "Loading the index."}
    </p>
  );
}
