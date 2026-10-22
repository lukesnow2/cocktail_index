import { useEffect, useState } from "react";
import type { CoreCatalog, Recipe } from "./engine/types";

export interface LoadedCatalog {
  core: CoreCatalog;
  recipes: Recipe[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Loads the static catalog written by scripts/build_catalog.py. */
export function useCatalog(): { data: LoadedCatalog | null; error: string | null } {
  const [data, setData] = useState<LoadedCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const core = await fetchJson<CoreCatalog>("/catalog/core.json");
      const perBook = await Promise.all(
        core.books.map(async (b) =>
          (await fetchJson<Omit<Recipe, "book">[]>(`/catalog/books/${b.id}.json`)).map((r) => ({ ...r, book: b.id })),
        ),
      );
      if (!cancelled) setData({ core, recipes: perBook.flat() });
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}
