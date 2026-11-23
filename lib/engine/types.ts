// Shapes of the files written by scripts/build_catalog.py into public/catalog/.

export type NodeId = string;
export type Flag = "staple" | "fresh" | "garnish" | "housemade" | "batch" | "qualifier";
/** Flags a user can choose to treat as always on hand. A "batch" (a pre-mixed spirit
 * blend from the book) never is; "qualifier" marks origin/colour/strength tags. */
export type AssumableFlag = Exclude<Flag, "batch" | "qualifier">;
export const ASSUMABLE_FLAGS: readonly AssumableFlag[] = ["staple", "fresh", "garnish", "housemade"];

export interface TaxonomyNode {
  id: NodeId;
  name: string;
  /** Owning this node satisfies requirements for any of its ancestors. */
  parents: NodeId[];
  section: string;
  flags: Flag[];
}

export interface Book {
  id: string;
  title: string;
  short: string;
  author: string;
  year: string;
  credit: string;
  recipeCount: number;
}

/** A curated swap: a recipe asking for `need` can use `use` (or anything under it). */
export interface Substitute {
  need: NodeId;
  use: NodeId;
  note: string;
}

export interface Ingredient {
  /** Satisfied by owning any of these nodes, or anything beneath them. */
  anyOf: NodeId[];
  /** Qualifiers the SAME owned item must also carry (origin, white, overproof). */
  with?: NodeId[];
  /** Bottles the book names on this line; owning one always satisfies it. */
  bottles?: string[];
  /** For lines naming no bottle: Smuggler's Cove-style picks, shown as a hint only. */
  suggest?: NodeId[];
  /** The book index's own label for this line. */
  source: string;
  /** The bottle the book names, if any. */
  note?: string;
  /** e.g. "chamomile-infused", "clarified". */
  prep?: string;
}

export interface Recipe {
  id: string;
  name: string;
  book: string;
  page: number | string | null;
  ingredients: Ingredient[];
}

/** A real bottle people search for; owning it means owning each of its nodes. */
export interface Bottle {
  id: string;
  name: string;
  nodes: NodeId[];
  aliases: string[];
}

export interface CoreCatalog {
  books: Book[];
  taxonomy: TaxonomyNode[];
  substitutes: Substitute[];
  bottles: Bottle[];
}

/** Which kinds of ingredients to treat as always on hand. */
export type Assumptions = Record<AssumableFlag, boolean>;

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  staple: true,
  fresh: true,
  housemade: true,
  garnish: true,
};
