import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buyNext, Catalog, evaluate, recipesHelped, usage, type OwnedItem } from "./engine";
import type { Assumptions, CoreCatalog, Ingredient, Recipe, TaxonomyNode } from "./types";
import { DEFAULT_ASSUMPTIONS } from "./types";

const NONE: Assumptions = { staple: false, fresh: false, housemade: false, garnish: false };

function node(id: string, parents: string[] = [], flags: TaxonomyNode["flags"] = []): TaxonomyNode {
  return { id, name: id, parents, section: "test", flags };
}
const ing = (...anyOf: string[]): Ingredient => ({ anyOf, source: anyOf.join(" or ") });
const recipe = (id: string, ...ingredients: Ingredient[]): Recipe => ({ id, name: id, book: "t", page: 1, ingredients });
/** Categories ticked on their own; "a&b" is one item carrying both. */
const items = (...ids: string[]): OwnedItem[] => ids.map((id) => ({ key: `n:${id}`, nodes: id.split("&") }));

// rum
// ├── aged-rum
// │   └── blended-aged-rum
// └── jamaican-rum            (an origin tag, carried alongside a class)
const mini: CoreCatalog = {
  books: [],
  bottles: [],
  taxonomy: [
    node("rum"),
    node("aged-rum", ["rum"]),
    node("blended-aged-rum", ["aged-rum"]),
    node("jamaican-rum", ["rum"]),
    node("sweet-vermouth"),
    node("punt-e-mes"),
    node("london-dry-gin"),
    node("plymouth-gin"),
    node("campari"),
    node("aperol"),
    node("lime-juice", [], ["fresh"]),
    node("lime", ["lime-juice"], ["fresh"]),
    node("orgeat", [], ["housemade"]),
    node("mint", [], ["garnish"]),
    node("house-batch", [], ["batch"]),
  ],
  substitutes: [
    { need: "london-dry-gin", use: "plymouth-gin", note: "softer" },
    { need: "plymouth-gin", use: "london-dry-gin", note: "" },
  ],
};

describe("matching", () => {
  it("lets a specific item satisfy every broader requirement above it", () => {
    const c = new Catalog(mini, [recipe("a", ing("rum")), recipe("b", ing("aged-rum")), recipe("c", ing("jamaican-rum"))]);
    const results = evaluate(c, items("blended-aged-rum&jamaican-rum"), NONE);
    expect(results.map((r) => r.status)).toEqual(["ready", "ready", "ready"]);
  });

  it("does not let a broad item satisfy a more specific requirement", () => {
    const c = new Catalog(mini, [recipe("a", ing("blended-aged-rum"))]);
    expect(evaluate(c, items("rum", "aged-rum"), NONE)[0].status).toBe("missing");
  });

  it("needs one item to carry a requirement's qualifiers, not two separate items", () => {
    const jamaicanBlendedAged: Ingredient = { ...ing("blended-aged-rum"), with: ["jamaican-rum"] };
    const c = new Catalog(mini, [recipe("a", jamaicanBlendedAged)]);
    expect(evaluate(c, items("blended-aged-rum", "jamaican-rum"), NONE)[0].status).toBe("missing");
    expect(evaluate(c, items("blended-aged-rum&jamaican-rum"), NONE)[0].status).toBe("ready");
  });

  it("always accepts the exact bottle the book names", () => {
    const line: Ingredient = { ...ing("sweet-vermouth"), bottles: ["punt-e-mes-bottle"] };
    const c = new Catalog(mini, [recipe("a", line)]);
    const puntEMes: OwnedItem = { key: "b:punt-e-mes-bottle", nodes: ["punt-e-mes"], bottle: "punt-e-mes-bottle" };
    expect(evaluate(c, items("punt-e-mes"), NONE)[0].status).toBe("missing"); // the category alone isn't the named bottle
    expect(evaluate(c, [puntEMes], NONE)[0].ingredients[0].status).toMatchObject({ kind: "have", via: "b:punt-e-mes-bottle" });
  });

  it("uses a curated substitute and reports it", () => {
    const c = new Catalog(mini, [recipe("a", ing("london-dry-gin"))]);
    const [r] = evaluate(c, items("plymouth-gin"), NONE);
    expect(r.status).toBe("substitute");
    expect(r.ingredients[0].status).toMatchObject({ kind: "substitute", need: "london-dry-gin", use: "plymouth-gin", note: "softer" });
  });

  it("never substitutes without a curated swap", () => {
    const c = new Catalog(mini, [recipe("a", ing("aperol"))]);
    expect(evaluate(c, items("campari"), NONE)[0].status).toBe("missing");
  });

  it("prefers owning over substituting", () => {
    const c = new Catalog(mini, [recipe("a", ing("london-dry-gin"))]);
    expect(evaluate(c, items("plymouth-gin", "london-dry-gin"), NONE)[0].status).toBe("ready");
  });

  it("honours assumptions per flag", () => {
    const c = new Catalog(mini, [recipe("a", ing("rum"), ing("lime-juice"), ing("orgeat"), ing("mint"))]);
    expect(evaluate(c, items("rum"), DEFAULT_ASSUMPTIONS)[0].status).toBe("ready");
    const [strict] = evaluate(c, items("rum"), NONE);
    expect(strict.missing.map((m) => m.anyOf[0])).toEqual(["lime-juice", "orgeat", "mint"]);
  });

  it("never assumes or suggests a book's pre-batched spirit mix", () => {
    const c = new Catalog(mini, [recipe("a", ing("house-batch"), ing("rum"))]);
    const results = evaluate(c, items("rum"), DEFAULT_ASSUMPTIONS);
    expect(results[0].status).toBe("missing");
    expect(buyNext(c, results)).toEqual([]);
  });

  it("lets a raw ingredient satisfy what's made from it", () => {
    const c = new Catalog(mini, [recipe("a", ing("lime-juice"))]);
    expect(evaluate(c, items("lime"), NONE)[0].status).toBe("ready");
  });

  it("counts a requirement listed twice as one missing item", () => {
    const c = new Catalog(mini, [recipe("a", ing("rum"), ing("rum"))]);
    expect(evaluate(c, [], NONE)[0].missing).toHaveLength(1);
  });

  it("ignores owned ids the catalog no longer has", () => {
    const c = new Catalog(mini, [recipe("a", ing("rum"))]);
    expect(evaluate(c, items("retired-node", "rum"), NONE)[0].status).toBe("ready");
  });
});

describe("buyNext", () => {
  it("suggests the specific category that unlocks recipes across several requirements", () => {
    const c = new Catalog(mini, [
      recipe("a", ing("campari"), ing("aged-rum")),
      recipe("b", ing("campari"), ing("blended-aged-rum")),
      recipe("c", ing("campari"), ing("rum")),
    ]);
    const [top] = buyNext(c, evaluate(c, items("campari"), NONE));
    expect(top.nodes).toEqual(["blended-aged-rum"]);
    expect(top.unlocks.map((r) => r.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("suggests the broad category when nothing more specific does better", () => {
    const c = new Catalog(mini, [recipe("a", ing("campari"), ing("rum")), recipe("b", ing("campari"), ing("rum"))]);
    expect(buyNext(c, evaluate(c, items("campari"), NONE)).map((s) => s.nodes)).toEqual([["rum"]]);
  });

  it("drops a broad category once a more specific one under it is suggested", () => {
    const c = new Catalog(mini, [recipe("a", ing("campari"), ing("rum")), recipe("b", ing("campari"), ing("aged-rum"))]);
    expect(buyNext(c, evaluate(c, items("campari"), NONE)).map((s) => s.nodes)).toEqual([["aged-rum"]]);
  });

  it("suggests the combination one bottle must carry", () => {
    const c = new Catalog(mini, [
      recipe("a", ing("campari"), { ...ing("blended-aged-rum"), with: ["jamaican-rum"] }),
      recipe("b", ing("campari"), ing("rum")),
    ]);
    const [top] = buyNext(c, evaluate(c, items("campari"), NONE));
    expect(top.nodes).toEqual(["blended-aged-rum", "jamaican-rum"]);
    expect(top.unlocks.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("drops a plain class once a combination built on it is suggested", () => {
    const c = new Catalog(mini, [
      recipe("a", ing("campari"), { ...ing("blended-aged-rum"), with: ["jamaican-rum"] }),
      recipe("b", ing("campari"), ing("blended-aged-rum")),
    ]);
    expect(buyNext(c, evaluate(c, items("campari"), NONE)).map((s) => s.nodes)).toEqual([["blended-aged-rum", "jamaican-rum"]]);
  });

  it("skips recipes missing more than one thing and labels preps as make", () => {
    const c = new Catalog(mini, [recipe("a", ing("rum"), ing("orgeat")), recipe("b", ing("campari"), ing("orgeat"))]);
    const s = buyNext(c, evaluate(c, items("rum"), NONE));
    expect(s).toEqual([{ nodes: ["orgeat"], action: "make", unlocks: [expect.objectContaining({ id: "a" })] }]);
  });
});

describe("usage", () => {
  it("credits a category with every recipe it could help on its own", () => {
    const c = new Catalog(mini, [
      recipe("a", ing("rum")),
      recipe("b", ing("aged-rum")),
      recipe("c", { ...ing("blended-aged-rum"), with: ["jamaican-rum"] }),
    ]);
    const u = usage(c);
    expect(u.get("blended-aged-rum")).toBe(2); // a and b; c needs a Jamaican one
    expect(u.get("campari")).toBeUndefined();
    expect(recipesHelped(c, ["blended-aged-rum", "jamaican-rum"])).toBe(3);
  });
});

describe("real catalog", () => {
  const dir = join(__dirname, "../../public/catalog");
  const core: CoreCatalog = JSON.parse(readFileSync(join(dir, "core.json"), "utf8"));
  const recipes: Recipe[] = core.books.flatMap((b) =>
    (JSON.parse(readFileSync(join(dir, "books", `${b.id}.json`), "utf8")) as Omit<Recipe, "book">[]).map((r) => ({ ...r, book: b.id })),
  );
  const c = new Catalog(core, recipes);
  const bottle = (name: string): OwnedItem => {
    const b = core.bottles.find((x) => x.name === name);
    if (!b) throw new Error(`no bottle ${name}`);
    return { key: `b:${b.id}`, nodes: b.nodes, bottle: b.id };
  };

  it("has a sound taxonomy and only references known ingredients", () => {
    for (const n of core.taxonomy) expect(() => c.ancestors(n.id)).not.toThrow();
    for (const r of recipes) for (const i of r.ingredients) for (const a of [...i.anyOf, ...(i.with ?? [])]) expect(c.nodes.has(a)).toBe(true);
  });

  it("treats whole eggs as covering egg whites, but not the reverse", () => {
    expect(c.ancestors("egg").has("egg-white")).toBe(true);
    expect(c.ancestors("egg-white").has("egg")).toBe(false);
  });

  it("keeps near-miss bottles out of the hierarchy", () => {
    expect(c.ancestors("punt-e-mes").has("sweet-vermouth")).toBe(false);
    expect(c.ancestors("blue-curacao").has("orange-liqueur")).toBe(false);
    expect(c.ancestors("blackstrap-rum").has("dark-rum")).toBe(false);
    expect(c.substitutesFor("aperol")).toEqual([]);
  });

  it("bridges Death & Co's 'Jamaican rum: Appleton V/X' to the Smuggler's Cove class plus origin", () => {
    const appletonLines = recipes.filter((r) => r.book === "dnc" && r.ingredients.some((i) => /Appleton Estate V\/X/.test(i.note ?? "")));
    expect(appletonLines.length).toBeGreaterThan(10);
    const makes = (b: OwnedItem) => evaluate(new Catalog(core, appletonLines), [b], DEFAULT_ASSUMPTIONS)
      .map((r) => r.ingredients.find((i) => /Appleton/.test(i.ingredient.note ?? ""))!.status.kind);
    expect(makes(bottle("Appleton Estate Signature")).every((k) => k === "have")).toBe(true);
    expect(makes(bottle("El Dorado 12 Year")).every((k) => k === "missing")).toBe(true); // right class, wrong island
  });

  it("lets a book-named bottle satisfy its own line even when indexed broadly", () => {
    const punt = recipes.filter((r) => r.ingredients.some((i) => i.note === "Punt E Mes"));
    const results = evaluate(new Catalog(core, punt), [bottle("Punt e Mes")], DEFAULT_ASSUMPTIONS);
    for (const r of results) expect(r.ingredients.find((i) => i.ingredient.note === "Punt E Mes")!.status.kind).toBe("have");
  });
});
