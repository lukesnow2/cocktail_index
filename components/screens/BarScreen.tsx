"use client";

import { useMemo, useState } from "react";
import { Loading, useApp, type AppState } from "@/components/AppProvider";
import { Button } from "@/components/ui/Button";
import { CheckRow } from "@/components/ui/CheckRow";
import { GroupHeader } from "@/components/ui/GroupHeader";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchField } from "@/components/ui/SearchField";
import { Tabs } from "@/components/ui/Tabs";
import { recipesHelped } from "@/lib/engine/engine";
import type { Bottle, TaxonomyNode } from "@/lib/engine/types";
import { useLanding } from "@/lib/landing";
import { searchBottles } from "@/lib/search";
import { fold, itemLabel, SECTIONS, shortName } from "@/lib/text";

/** My Bar's six tabs, each a run of catalog sections in shelf order. */
const TABS: { id: string; label: string; sections: string[] }[] = [
  { id: "spirits", label: "Spirits", sections: ["gin", "whiskey", "rum", "agave", "brandy", "vodka", "other-spirits"] },
  { id: "liqueurs", label: "Liqueurs", sections: ["liqueurs"] },
  { id: "amari", label: "Amari", sections: ["amari"] },
  { id: "vermouth", label: "Vermouth", sections: ["vermouth", "fortified", "wine-beer"] },
  { id: "bitters", label: "Bitters", sections: ["bitters"] },
  { id: "pantry", label: "Pantry", sections: ["sweeteners", "juice", "produce", "dairy-eggs", "mixers", "pantry", "housemade", "garnish"] },
];
const SECTION_LABEL = new Map(SECTIONS.map((s) => [s.id, s.label]));
/** With an empty bar, each category shows only its most used entries so the first ticks are easy. */
const STARTER_ROWS = 6;

interface Row {
  key: string;
  name: string;
  count: number;
  checked: boolean;
  covered?: string;
  hint?: string;
  toggle: () => void;
}

function sectionRows(app: AppState, section: string): Row[] {
  const { catalog, usage, items, itemName, myOwned, myBottles, setOwned, setBottle, state } = app;
  const direct = new Set(myOwned);
  const rows: Row[] = [];

  // what's on the shelf first: bottles and combinations, each removable here
  for (const b of myBottles) {
    if (catalog.node(b.nodes[0]).section !== section) continue;
    rows.push({
      key: `b:${b.id}`,
      name: b.name,
      count: recipesHelped(catalog, b.nodes, b.id),
      checked: true,
      hint: `Counts as ${itemLabel(catalog, b.nodes)}`,
      toggle: () => setBottle(b.id, false),
    });
  }
  for (const combo of myOwned.filter((o) => o.includes("&"))) {
    const nodes = combo.split("&");
    if (catalog.node(nodes[0]).section !== section) continue;
    rows.push({ key: `n:${combo}`, name: itemLabel(catalog, nodes), count: recipesHelped(catalog, nodes), checked: true, toggle: () => setOwned(combo, false) });
  }

  const hasChildren = (n: TaxonomyNode) => (catalog.children.get(n.id) ?? []).some((c) => catalog.node(c).section === section);
  const styles = catalog.core.taxonomy
    .filter((n) => n.section === section && !n.flags.includes("batch") && ((usage.get(n.id) ?? 0) > 0 || direct.has(n.id)))
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  for (const n of styles) {
    const checked = direct.has(n.id);
    // a broader entry an owned bottle already satisfies: "Gin, any style" covered by your London Dry
    const coverer = checked ? undefined : items.find((it) => it.key !== `n:${n.id}` && catalog.covers(it.nodes).has(n.id));
    let hint: string | undefined;
    if (!checked && !coverer) {
      const swap = catalog.substitutesFor(n.id).map((s) => items.find((it) => catalog.covers(it.nodes).has(s.use))).find(Boolean);
      if (swap) hint = `You can swap in ${itemName(swap.key)}`;
      else if (catalog.assumedFlag(n.id, state.assumptions)) hint = "Assumed on hand";
    }
    rows.push({
      key: n.id,
      name: hasChildren(n) && !n.parents.length ? `${shortName(n.name)}, any style` : shortName(n.name),
      count: usage.get(n.id) ?? 0,
      checked,
      covered: coverer ? itemName(coverer.key) : undefined,
      hint,
      toggle: () => setOwned(n.id, !checked),
    });
  }
  return rows;
}

function SearchResults({ app, query, onAdded }: { app: AppState; query: string; onAdded: () => void }) {
  const { catalog, usage, myBottles, myOwned, setBottle, setOwned } = app;
  const owned = new Set([...myBottles.map((b) => b.id), ...myOwned]);
  const matches = searchBottles(catalog.core.bottles, query, 6);
  const exact = matches.filter((m) => m.exact).map((m) => m.bottle);
  const similar = matches.filter((m) => !m.exact).map((m) => m.bottle);
  const q = fold(query.trim());
  const styles = catalog.core.taxonomy
    .filter((n) => !n.flags.includes("batch") && fold(n.name).includes(q) && (usage.get(n.id) ?? 0) > 0)
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0))
    .slice(0, 4);

  const recipes = (n: number) => (
    <>
      <span className="ref">{n}</span> {n === 1 ? "recipe" : "recipes"}
    </>
  );
  const addButton = (id: string, add: () => void) =>
    owned.has(id) ? (
      <span className="ref text-muted">IN YOUR BAR</span>
    ) : (
      <Button
        variant="primary"
        compact
        onClick={() => {
          add();
          onAdded();
        }}
      >
        Add
      </Button>
    );
  const bottleRow = (b: Bottle) => (
    <li key={b.id} className="ci-search-result">
      <span className="ci-search-result-text">
        <span className="item">{b.name}</span>
        <span className="caption text-muted">
          counts as {itemLabel(catalog, b.nodes)} · {recipes(recipesHelped(catalog, b.nodes, b.id))}
        </span>
      </span>
      {addButton(b.id, () => setBottle(b.id, true))}
    </li>
  );

  return (
    <ul className="ci-search-results">
      {exact.map(bottleRow)}
      {styles.map((n) => (
        <li key={n.id} className="ci-search-result">
          <span className="ci-search-result-text">
            <span className="item">{shortName(n.name)}</span>
            <span className="caption text-muted">any bottle of this style · {recipes(usage.get(n.id) ?? 0)}</span>
          </span>
          {addButton(n.id, () => setOwned(n.id, true))}
        </li>
      ))}
      {!exact.length && (
        <li className="ci-search-note secondary">
          We don&apos;t know that bottle yet. Pick its style below{similar.length ? ", or one of these if it's really one of them" : ""}.
        </li>
      )}
      {!exact.length && similar.map(bottleRow)}
    </ul>
  );
}

export function BarScreen() {
  const app = useApp();
  useLanding();
  const [tab, setTab] = useState(TABS[0].id);
  const [query, setQuery] = useState("");

  const tabCounts = useMemo(() => {
    const out = new Map<string, number>();
    if (!app) return out;
    for (const it of app.items) {
      const section = app.catalog.node(it.nodes[0]).section;
      const t = TABS.find((x) => x.sections.includes(section));
      if (t) out.set(t.id, (out.get(t.id) ?? 0) + 1);
    }
    return out;
  }, [app]);

  if (!app) return <Loading />;
  const n = app.items.length;
  const current = TABS.find((t) => t.id === tab)!;
  const starter = n === 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="My Bar" meta={`${n} ${n === 1 ? "BOTTLE" : "BOTTLES"}`} />
      <SearchField
        label="Add a bottle or brand"
        placeholder="Add a bottle or brand"
        value={query}
        onChange={setQuery}
        results={query.trim() ? <SearchResults app={app} query={query} onAdded={() => setQuery("")} /> : undefined}
      />
      <Tabs
        variant="inline"
        label="Sections"
        selected={tab}
        onSelect={setTab}
        tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: tabCounts.get(t.id) ?? 0 }))}
      />
      <div className="flex flex-col gap-6">
        {current.sections.map((section) => {
          const rows = sectionRows(app, section);
          if (!rows.length) return null;
          const shown = starter ? rows.slice(0, STARTER_ROWS) : rows;
          const have = rows.filter((r) => r.checked || r.covered).length;
          return (
            <section key={section}>
              <GroupHeader name={SECTION_LABEL.get(section) ?? section} meta={`${have} OF ${rows.length} · BY RECIPES`} />
              {shown.map((r) => (
                <CheckRow key={r.key} name={r.name} count={r.count} checked={r.checked} covered={r.covered} hint={r.hint} onToggle={r.toggle} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
