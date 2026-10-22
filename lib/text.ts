/** Lowercase and strip accents so "creme" finds "Crème" and "cana" finds "Caña". */
export function fold(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Same ids as scripts/build_catalog.py's slug(): "Planteray 3 Stars" -> "planteray-3-stars". */
export function slug(s: string): string {
  return fold(s).replace(/['’‘]/g, "'").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** "Triple Sec (e.g. Cointreau)" -> "Triple Sec": the hint helps when picking, not when listing. */
export function shortName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "");
}

/** How a qualifier reads after a class: "Jamaican Rum" -> "Jamaican", "White / Light Rum" -> "White". */
export function qualifierName(name: string): string {
  return shortName(name).replace(/ \/ .*$/, "").replace(/ Rum$/, "");
}

/**
 * "Blended Lightly Aged Rum · Jamaican · White" for an item or requirement carrying
 * several nodes: the class leads, origin / colour / strength tags follow.
 */
export function itemLabel(catalog: { node(id: string): { name: string; flags: string[] } }, nodes: string[]): string {
  const isTag = (n: string) => catalog.node(n).flags.includes("qualifier");
  const ordered = [...nodes.filter((n) => !isTag(n)), ...nodes.filter(isTag)];
  const [first, ...rest] = ordered;
  return [shortName(catalog.node(first).name), ...rest.map((n) => qualifierName(catalog.node(n).name))].join(" · ");
}

export const SECTIONS: { id: string; label: string }[] = [
  { id: "gin", label: "Gin & Genever" },
  { id: "whiskey", label: "Whiskey" },
  { id: "rum", label: "Rum & Cane" },
  { id: "agave", label: "Tequila & Mezcal" },
  { id: "brandy", label: "Brandy & Eau de Vie" },
  { id: "vodka", label: "Vodka" },
  { id: "other-spirits", label: "Other Spirits" },
  { id: "liqueurs", label: "Liqueurs" },
  { id: "amari", label: "Amari & Bitter Apéritifs" },
  { id: "vermouth", label: "Vermouth & Aromatized Wine" },
  { id: "fortified", label: "Sherry, Port & Madeira" },
  { id: "wine-beer", label: "Wine, Beer & Cider" },
  { id: "bitters", label: "Bitters" },
  { id: "sweeteners", label: "Syrups & Sweeteners" },
  { id: "juice", label: "Juices" },
  { id: "produce", label: "Fruit & Herbs" },
  { id: "dairy-eggs", label: "Dairy & Eggs" },
  { id: "mixers", label: "Mixers" },
  { id: "pantry", label: "Pantry" },
  { id: "housemade", label: "House-Made Preps" },
  { id: "garnish", label: "Garnish" },
];
