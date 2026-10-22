// How engine results read on screen. One place for the mapping in the design system's
// build guide (section 6), so every screen words things the same way.
import type { Catalog, IngredientStatus, RecipeResult, Suggestion } from "./engine/engine";
import type { Ingredient, NodeId, Recipe } from "./engine/types";
import { fold, itemLabel, qualifierName, shortName } from "./text";

export const nodeName = (catalog: Catalog, id: NodeId) => shortName(catalog.node(id).name);

/** "Blended Lightly Aged Rum · Jamaican", "Absinthe or Pastis", "Gin (Earl Grey-infused)". */
export function requirementName(catalog: Catalog, ing: Ingredient): string {
  const base = [
    ing.anyOf.map((id) => nodeName(catalog, id)).join(" or "),
    ...(ing.with ?? []).map((id) => qualifierName(catalog.node(id).name)),
  ].join(" · ");
  return ing.prep ? `${base} (${ing.prep})` : base;
}

const isGarnish = (catalog: Catalog, ing: Ingredient) => ing.anyOf.every((id) => catalog.node(id).flags.includes("garnish"));

/** The ingredient line under a drink name: names only, in book order, garnishes left off. */
export function ingredientLine(catalog: Catalog, recipe: Recipe): string[] {
  const names = recipe.ingredients.filter((i) => !isGarnish(catalog, i)).map((i) => requirementName(catalog, i));
  return [...new Set(names)];
}

/** "London Dry Gin for Plymouth Gin": the first swap a ready-with-swap drink relies on. */
export function swapPhrase(catalog: Catalog, r: RecipeResult): string | undefined {
  const s = r.ingredients.find((i) => i.status.kind === "substitute")?.status;
  if (s?.kind !== "substitute") return undefined;
  return `${nodeName(catalog, s.use)} for ${nodeName(catalog, s.need)}`;
}

export const missingNames = (catalog: Catalog, r: RecipeResult) => r.missing.map((m) => requirementName(catalog, m));

const ASSUMED_DETAIL = {
  fresh: "Fresh, assumed on hand",
  housemade: "Housemade, the book gives the recipe",
  staple: "Pantry staple, assumed on hand",
  garnish: "Garnish, assumed on hand",
} as const;

/** The one line of detail under an ingredient on the drink page. */
export function ingredientDetail(
  catalog: Catalog,
  ing: Ingredient,
  status: IngredientStatus,
  itemName: (key: string) => string,
  adds?: number,
): string {
  const parts: string[] = [];
  if (status.kind === "have") parts.push(`Your ${itemName(status.via)}`);
  if (status.kind === "assumed") parts.push(ASSUMED_DETAIL[status.flag]);
  if (status.kind === "substitute") parts.push(`Use your ${itemName(status.via)}. Same style, different label`);
  if (status.kind === "missing") parts.push(adds ? `Not in your bar. Adds ${adds} ${adds === 1 ? "drink" : "drinks"}` : "Not in your bar");
  if (ing.note && fold(ing.note) !== fold(requirementName(catalog, ing))) parts.push(`Book uses ${ing.note}`);
  if (ing.suggest?.length) parts.push(`Smuggler's Cove pick: ${ing.suggest.map((id) => nodeName(catalog, id)).join(" or ")}`);
  // each part is a sentence without its full stop
  return parts.length ? `${parts.join(". ")}.` : "";
}

export const markState = (s: IngredientStatus) => (s.kind === "missing" ? "missing" : s.kind === "substitute" ? "swap" : "have");

/** A Buy Next suggestion's name, with one real bottle as an example where it helps. */
export function suggestionName(catalog: Catalog, s: Suggestion, example?: string): string {
  const name = itemLabel(catalog, s.nodes);
  return example && fold(example) !== fold(name) ? `${name}, e.g. ${example}` : name;
}

/** "Last Word (PDT 162)" */
export function drinkRef(r: Recipe, bookShort: (id: string) => string): string {
  return `${r.name} (${bookShort(r.book)}${r.page != null ? ` ${r.page}` : ""})`;
}

/** How a drink sorts in the A to Z list: accents folded, a leading "The" ignored. */
export const sortKey = (name: string) => fold(name.replace(/^the\s+/i, ""));

/** The letter a drink files under: "#" for anything not starting with a letter. */
export function indexLetter(name: string): string {
  const c = sortKey(name).charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

export const drinkHref = (id: string, from?: string) => `/drinks/${encodeURIComponent(id)}${from ? `?from=${from}` : ""}`;
