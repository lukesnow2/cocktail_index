import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CoreCatalog } from "./engine/types";
import { searchBottles } from "./search";

const core: CoreCatalog = JSON.parse(readFileSync(join(__dirname, "../public/catalog/core.json"), "utf8"));
const names = (q: string) => searchBottles(core.bottles, q).map((m) => m.bottle.name);

describe("searchBottles", () => {
  it("finds a bottle from a casual name", () => {
    expect(names("appleton 12")).toEqual(["Appleton Estate 12 Year Rare Casks"]);
    expect(names("appleton 12 yr")).toEqual(["Appleton Estate 12 Year Rare Casks"]);
    expect(names("smith and cross")[0]).toBe("Smith & Cross Jamaica Rum");
  });

  it("still searches on a filler word when it's all that was typed", () => {
    expect(names("old")).toContain("Old Forester Rye");
  });

  it("ignores accents and finds old labels through aliases", () => {
    expect(names("appleton v/x")).toEqual(["Appleton Estate Signature"]);
    expect(names("cana brava")).toContain("Caña Brava");
  });

  it("maps a peated malt to both of its categories", () => {
    const [m] = searchBottles(core.bottles, "laphroaig");
    expect(m.bottle.nodes).toEqual(["single-malt-scotch", "peated-scotch"]);
  });

  it("doesn't guess when the exact bottle is unknown", () => {
    const results = searchBottles(core.bottles, "appleton 30");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((m) => !m.exact)).toBe(true);
  });

  it("returns nothing for an empty query", () => {
    expect(searchBottles(core.bottles, "  ")).toEqual([]);
  });
});
