import { ASSUMABLE_FLAGS } from "./types";
import type {
  AssumableFlag,
  Assumptions,
  CoreCatalog,
  Ingredient,
  NodeId,
  Recipe,
  Substitute,
  TaxonomyNode,
} from "./types";

/** Indexed view of the taxonomy and recipes. Build once per catalog load. */
export class Catalog {
  readonly nodes: Map<NodeId, TaxonomyNode>;
  readonly children: Map<NodeId, NodeId[]>;
  private readonly ancestorCache = new Map<NodeId, Set<NodeId>>();
  private readonly descendantCache = new Map<NodeId, Set<NodeId>>();
  private readonly coversCache = new Map<string, Set<NodeId>>();
  private readonly subsByNeed: Map<NodeId, Substitute[]>;

  constructor(
    readonly core: CoreCatalog,
    readonly recipes: Recipe[],
  ) {
    this.nodes = new Map(core.taxonomy.map((n) => [n.id, n]));
    this.children = new Map(core.taxonomy.map((n) => [n.id, [] as NodeId[]]));
    for (const n of core.taxonomy) {
      for (const p of n.parents) this.children.get(p)?.push(n.id);
    }
    this.subsByNeed = new Map();
    for (const s of core.substitutes) {
      const list = this.subsByNeed.get(s.need) ?? [];
      list.push(s);
      this.subsByNeed.set(s.need, list);
    }
  }

  node(id: NodeId): TaxonomyNode {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`unknown ingredient ${id}`);
    return n;
  }

  /** The node and everything it satisfies (itself, parents, grandparents...). */
  ancestors(id: NodeId): Set<NodeId> {
    let out = this.ancestorCache.get(id);
    if (!out) {
      out = new Set([id]);
      for (const p of this.node(id).parents) for (const a of this.ancestors(p)) out.add(a);
      this.ancestorCache.set(id, out);
    }
    return out;
  }

  /** The node and everything that satisfies it. */
  descendants(id: NodeId): Set<NodeId> {
    let out = this.descendantCache.get(id);
    if (!out) {
      out = new Set([id]);
      for (const c of this.children.get(id) ?? []) for (const d of this.descendants(c)) out.add(d);
      this.descendantCache.set(id, out);
    }
    return out;
  }

  /** Everything one item carrying all of `nodes` satisfies; unknown ids are ignored. */
  covers(nodes: NodeId[]): Set<NodeId> {
    const key = nodes.join("&");
    let out = this.coversCache.get(key);
    if (!out) {
      out = new Set(nodes.flatMap((n) => (this.nodes.has(n) ? [...this.ancestors(n)] : [])));
      this.coversCache.set(key, out);
    }
    return out;
  }

  /** The assumption that puts this node on hand, if the user has it switched on. */
  assumedFlag(id: NodeId, assumptions: Assumptions): AssumableFlag | undefined {
    const flags = this.node(id).flags;
    return ASSUMABLE_FLAGS.find((f) => flags.includes(f) && assumptions[f]);
  }

  substitutesFor(need: NodeId): Substitute[] {
    return this.subsByNeed.get(need) ?? [];
  }
}

export type IngredientStatus =
  | { kind: "have"; need: NodeId; via: string }
  | { kind: "assumed"; flag: AssumableFlag }
  | { kind: "substitute"; need: NodeId; use: NodeId; via: string; note: string }
  | { kind: "missing" };

export type RecipeStatus = "ready" | "substitute" | "missing";

export interface RecipeResult {
  recipe: Recipe;
  status: RecipeStatus;
  ingredients: { ingredient: Ingredient; status: IngredientStatus }[];
  /** Distinct unmet requirements (duplicate lines collapse to one). */
  missing: Ingredient[];
}

/**
 * One thing on the shelf: a bottle (carrying every category it counts as, e.g. Appleton
 * Signature = Jamaican + Blended Lightly Aged) or a category ticked on its own.
 */
export interface OwnedItem {
  /** Stable id for display lookups: "b:<bottle id>" or "n:<node>[&<node>...]". */
  key: string;
  nodes: NodeId[];
  /** Set when the item is a catalog bottle, so lines naming that bottle recognise it. */
  bottle?: string;
}

interface Shelved {
  item: OwnedItem;
  /** Everything this one item satisfies. */
  covers: Set<NodeId>;
}

function shelve(catalog: Catalog, items: Iterable<OwnedItem>): Shelved[] {
  const out: Shelved[] = [];
  for (const item of items) {
    const covers = catalog.covers(item.nodes); // ids an older catalog had are ignored
    if (!covers.size && !item.bottle) continue;
    out.push({ item, covers });
  }
  return out;
}

/** The requirement node an item's coverage meets, with every qualifier on the same item. */
function meets(ing: Ingredient, covers: Set<NodeId>): NodeId | undefined {
  if (!(ing.with ?? []).every((w) => covers.has(w))) return undefined;
  return ing.anyOf.find((a) => covers.has(a));
}

function ingredientStatus(catalog: Catalog, ing: Ingredient, shelf: Shelved[], assumptions: Assumptions): IngredientStatus {
  for (const s of shelf) {
    const need = meets(ing, s.covers);
    if (need) return { kind: "have", need, via: s.item.key };
  }
  // the exact bottle the book names always counts, even if the index filed it broadly
  for (const s of shelf) {
    if (s.item.bottle && ing.bottles?.includes(s.item.bottle)) return { kind: "have", need: ing.anyOf[0], via: s.item.key };
  }
  for (const need of ing.anyOf) {
    const flag = catalog.assumedFlag(need, assumptions);
    if (flag) return { kind: "assumed", flag };
  }
  for (const need of ing.anyOf) {
    for (const sub of catalog.substitutesFor(need)) {
      for (const s of shelf) {
        if (s.covers.has(sub.use) && (ing.with ?? []).every((w) => s.covers.has(w))) {
          return { kind: "substitute", need, use: sub.use, via: s.item.key, note: sub.note };
        }
      }
    }
  }
  return { kind: "missing" };
}

const requirementKey = (ing: Ingredient) => [[...ing.anyOf].sort().join("|"), ...[...(ing.with ?? [])].sort()].join("&");

export function evaluate(catalog: Catalog, owned: Iterable<OwnedItem>, assumptions: Assumptions): RecipeResult[] {
  const shelf = shelve(catalog, owned);
  return catalog.recipes.map((recipe) => {
    const ingredients = recipe.ingredients.map((ingredient) => ({
      ingredient,
      status: ingredientStatus(catalog, ingredient, shelf, assumptions),
    }));
    const missing = new Map<string, Ingredient>();
    for (const i of ingredients) {
      if (i.status.kind === "missing") missing.set(requirementKey(i.ingredient), i.ingredient);
    }
    const status: RecipeStatus = missing.size
      ? "missing"
      : ingredients.some((i) => i.status.kind === "substitute")
        ? "substitute"
        : "ready";
    return { recipe, status, ingredients, missing: [...missing.values()] };
  });
}

export interface Suggestion {
  /** One category, or a combination one bottle must carry ("Blended Lightly Aged" + "Jamaican"). */
  nodes: NodeId[];
  /** House-made preps are suggested as "make", everything else as "buy". */
  action: "buy" | "make";
  unlocks: Recipe[];
}

/**
 * What single purchase would unlock the most recipes that are one requirement away.
 *
 * Candidates are categories that could meet a missing requirement, plus, for
 * requirements with qualifiers, the combination itself ("a Jamaican blended lightly aged
 * rum"). Each candidate is credited with every pending recipe it would satisfy, so a
 * specific bottle (Appleton) can unlock recipes asking for "Jamaican rum" and "rum" at
 * once. A category is only suggested when it beats its parents; otherwise the broader
 * parent is suggested, leaving the shopper free to pick any bottle under it. A parent is
 * dropped once something more specific under it is suggested, so overlapping drinks
 * aren't listed twice (Applejack +16 already includes the 14 any apple brandy unlocks).
 */
export function buyNext(catalog: Catalog, results: RecipeResult[], limit = 10): Suggestion[] {
  const pending = results.filter((r) => r.missing.length === 1).map((r) => ({ recipe: r.recipe, ing: r.missing[0] }));
  const candidates = new Map<string, NodeId[]>();
  for (const { ing } of pending) {
    const quals = ing.with ?? [];
    for (const need of ing.anyOf) {
      if (quals.length) candidates.set([need, ...quals].join("&"), [need, ...quals]);
      for (const d of catalog.descendants(need)) {
        if (quals.every((w) => catalog.ancestors(d).has(w))) candidates.set(d, [d]);
      }
    }
  }
  const unlocks = new Map<string, Recipe[]>();
  for (const [key, nodes] of candidates) {
    const covers = catalog.covers(nodes);
    unlocks.set(key, pending.filter((p) => meets(p.ing, covers)).map((p) => p.recipe));
  }
  const count = (key: string) => unlocks.get(key)?.length ?? 0;
  const suggestions: Suggestion[] = [];
  for (const [key, nodes] of candidates) {
    const flags = nodes.flatMap((n) => catalog.node(n).flags);
    if (flags.includes("garnish") || flags.includes("batch")) continue; // not something you buy
    const recipes = unlocks.get(key)!;
    if (!recipes.length) continue;
    if (nodes.length === 1 && catalog.node(key).parents.some((p) => count(p) === recipes.length)) continue;
    suggestions.push({ nodes, action: flags.includes("housemade") ? "make" : "buy", unlocks: recipes });
  }
  // drop a category once something more specific under it is suggested, including a
  // combination built on it (a Jamaican blended lightly aged rum covers every drink a
  // plain blended lightly aged rum would)
  const moreSpecific = (s: Suggestion) =>
    s.nodes.length === 1 && suggestions.some((o) => o !== s && o.nodes.some((n) => catalog.ancestors(n).has(s.nodes[0])));
  const label = (s: Suggestion) => s.nodes.map((n) => catalog.node(n).name).join(" ");
  return suggestions
    .filter((s) => !moreSpecific(s))
    .sort((a, b) => b.unlocks.length - a.unlocks.length || label(a).localeCompare(label(b)))
    .slice(0, limit);
}

/** How many recipes one item carrying `nodes` (and optionally a named bottle) would help. */
export function recipesHelped(catalog: Catalog, nodes: NodeId[], bottle?: string): number {
  const covers = catalog.covers(nodes);
  return catalog.recipes.filter((r) =>
    r.ingredients.some((i) => meets(i, covers) || (bottle !== undefined && i.bottles?.includes(bottle))),
  ).length;
}

/** How many recipes ticking each category on its own would help (for "used in N drinks"). */
export function usage(catalog: Catalog): Map<NodeId, number> {
  const out = new Map<NodeId, number>();
  for (const r of catalog.recipes) {
    const helped = new Set<NodeId>();
    for (const ing of r.ingredients) {
      for (const a of ing.anyOf) {
        for (const d of catalog.descendants(a)) {
          if ((ing.with ?? []).every((w) => catalog.ancestors(d).has(w))) helped.add(d);
        }
      }
    }
    for (const d of helped) out.set(d, (out.get(d) ?? 0) + 1);
  }
  return out;
}
