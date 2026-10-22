#!/usr/bin/env python3
"""Build data/build/catalog.json from the book sources and the ingredient taxonomy.

Inputs (all under data/):
  books.csv        book metadata and which source file holds each book
  taxonomy.csv     ingredient hierarchy
  aliases.csv      source ingredient string -> taxonomy ids
  products.csv     product-name rules for resolving coarse categories via notes
  substitutes.csv  curated "recipe wants X, Y works" swaps
  bottles.csv      searchable bottles and the categories each one counts as
  sources/*.csv    tab-separated recipe rows: name, ingredient, notes, page

Run:  python3 scripts/build_catalog.py        (exits non-zero on any unmapped data)
"""
import csv
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = DATA / "build"


def read_csv(path, comments=True, **kw):
    """Read a CSV; hand-edited config files may use '#' comment lines, sources may not."""
    with open(path, encoding="utf-8", newline="") as f:
        lines = [l for l in f if not (comments and l.startswith("#"))]
    return list(csv.DictReader(lines, **kw))


def fold(s):
    """Lowercase, strip accents, unify quotes/dashes, for matching."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("’", "'").replace("‘", "'").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", s).strip().lower()


def normalize_ingredient(s):
    """Uppercase and rewrite 'X, Y' as 'X (Y)' so every book uses one shape."""
    s = re.sub(r"\s+", " ", s.strip().upper())
    m = re.match(r"^([^,(]+),\s*(.+)$", s)
    if m:
        s = f"{m.group(1).strip()} ({m.group(2).strip()})"
    if s.count("(") > s.count(")"):
        s += ")"
    return s


SMALL = {"a", "an", "and", "at", "by", "de", "del", "di", "du", "for", "in", "la", "le",
         "of", "on", "or", "the", "to", "with", "y", "en", "et"}
ACRONYMS = {"vs", "vsop", "xo", "ipa", "aoc", "pdt", "dom", "nyc", "usa", "uk", "ii", "iii", "iv"}


def smart_title(s):
    """Title-case ALL-CAPS source text; leave mixed-case text alone."""
    s = re.sub(r"\s+", " ", s.strip())
    if not s or s != s.upper():
        return s
    words = s.lower().split(" ")
    out = []
    for i, w in enumerate(words):
        bare = w.strip("()\"“”,")
        if bare in ACRONYMS:
            out.append(w.upper())
            continue
        if i and w in SMALL:
            out.append(w)
            continue
        # capitalise after start, hyphen, slash, paren, quote, period (J.M.); not after
        # apostrophe (Latroon's) except an O'/D' prefix; McX -> McX
        w = re.sub(r"(^|[-/(\"“.])([a-z])", lambda m: m.group(1) + m.group(2).upper(), w)
        w = re.sub(r"^([OD]')([a-z])", lambda m: m.group(1) + m.group(2).upper(), w)
        w = re.sub(r"^Mc([a-z])", lambda m: "Mc" + m.group(1).upper(), w)
        out.append(w)
    return " ".join(out)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", fold(s)).strip("-")


class Taxonomy:
    def __init__(self, rows):
        self.nodes = {}
        for r in rows:
            nid = r["id"].strip()
            if nid in self.nodes:
                raise SystemExit(f"taxonomy: duplicate id {nid}")
            self.nodes[nid] = {
                "id": nid,
                "name": r["name"].strip(),
                "parents": [p for p in r["parents"].split("|") if p],
                "section": r["section"].strip(),
                "flags": [f for f in r["flags"].split("|") if f],
            }
        errors = [f"taxonomy: {n['id']} has unknown parent {p}"
                  for n in self.nodes.values() for p in n["parents"] if p not in self.nodes]
        if errors:
            raise SystemExit("\n".join(errors))
        self._anc = {}
        for nid in self.nodes:
            self.ancestors(nid)

    def ancestors(self, nid, seen=()):
        if nid in self._anc:
            return self._anc[nid]
        if nid in seen:
            raise SystemExit(f"taxonomy: cycle through {nid}")
        out = {nid}
        for p in self.nodes[nid]["parents"]:
            out |= self.ancestors(p, seen + (nid,))
        self._anc[nid] = out
        return out

    def simplify(self, any_of):
        """Drop alternatives already covered by a broader alternative in the set."""
        s = list(dict.fromkeys(any_of))
        return [a for a in s if not any(b != a and b in self.ancestors(a) for b in s)]


# Smuggler's Cove sometimes notes origin in parentheses: "BLENDED AGED RUM (JAMAICA)".
ORIGIN_IN_NOTE = [(re.compile(r"\(jamaica\)"), "jamaican-rum"), (re.compile(r"\(guyana\)"), "demerara-rum"),
                  (re.compile(r"\(barbados\)"), "barbados-rum")]


GENERIC_TAIL = re.compile(r"( (rum|gin|liqueur|whiskey|whisky|bourbon|scotch|vodka|tequila|brandy|cognac|vermouth|sherry|bitters|aperitif|amaro))+$")


def exact_label(label):
    return re.sub(r"[^a-z0-9]+", " ", fold(label)).strip()


def bottle_key(label):
    """Loose key for matching a book's note to a bottle: "Luxardo Maraschino Liqueur"
    and "Luxardo Maraschino" match; a bare category word ("Gin") matches nothing."""
    k = re.sub(r"[^a-z0-9]+", " ", fold(label)).strip()
    return GENERIC_TAIL.sub("", k).strip()


class Resolver:
    def __init__(self, tax, aliases, products, bottle_rows=()):
        self.tax = tax
        # nodes flagged "qualifier" in taxonomy.csv (real origins, colour, strength) survive
        # when a named bottle's class replaces a coarse label; styles and age words don't
        self.qualifiers = {n["id"] for n in tax.nodes.values() if "qualifier" in n["flags"]}
        # book notes that name a known bottle -> that bottle's id, so the exact bottle a
        # recipe names always satisfies it even when the index filed it under a broader category
        self.bottle_ids = defaultdict(list)  # loose key -> [(id, nodes, exact labels)]
        for r in bottle_rows:
            labels = [x for x in [r["name"], *r["aliases"].split("|")] if x.strip()]
            entry = (slug(r["name"].strip()), r["node"].strip().split("+"), {exact_label(x) for x in labels})
            for k in {bottle_key(x) for x in labels}:
                if len(k) > 2:
                    self.bottle_ids[k].append(entry)
        self.aliases = {}
        self.problems = []
        for r in aliases:
            key = normalize_ingredient(r["raw"])
            if key in self.aliases:
                self.problems.append(f"aliases: {r['raw']!r} duplicates an earlier row for {key!r}")
            suggest = [s for s in (r.get("suggest") or "").strip().split("|") if s]
            self.aliases[key] = (r["node"].strip(), r["prep"].strip(), suggest)
        self.products = [(re.compile(r["pattern"], re.I), r["node"].strip()) for r in products]
        for raw, (spec, _, suggest) in self.aliases.items():
            for nid in self._spec_ids(spec) + suggest:
                if nid not in tax.nodes:
                    self.problems.append(f"aliases: {raw} -> unknown node {nid}")
        for _, nid in self.products:
            if nid not in tax.nodes:
                self.problems.append(f"products: unknown node {nid}")

    @staticmethod
    def _spec_ids(spec):
        if spec == "-":
            return []
        if spec.startswith("@"):
            spec = spec.split(":", 1)[1]
        return [n for part in spec.split("+") for alt in part.split("|") for n in alt.split("&")]

    def match_product(self, text):
        t = fold(text)
        for rx, nid in self.products:
            if rx.search(t):
                return nid
        return None

    @staticmethod
    def infusion(text):
        m = re.search(r"([\w' ]+?)\s*-\s*infused", fold(text))
        return f"{m.group(1).strip()}-infused" if m else ""

    def named_bottles(self, texts, alts):
        """Bottles a note names. A loose match ("Luxardo Maraschino Liqueur") must relate to
        the line's ingredient; an unrelated bottle counts only if named exactly, so
        "Plymouth" on a sloe gin line doesn't pick up Plymouth Gin."""
        def related(nodes):
            return any(n in self.tax.nodes and a in self.tax.nodes and (a in self.tax.ancestors(n) or n in self.tax.ancestors(a))
                       for n in nodes for a in alts)
        found = []
        for x in texts:
            for bid, nodes, exact in self.bottle_ids.get(bottle_key(x), []):
                if related(nodes) or exact_label(x) in exact:
                    found.append(bid)
        return list(dict.fromkeys(found))

    def from_notes(self, notes, fallback, groups_are_alternatives):
        """Resolve a coarse category from its notes. Returns ([(any_of, prep, bottles)],
        matched) where matched says whether any named product was recognised."""
        reqs, pending_prep, unmatched = [], "", []
        for group in [g for g in re.split(r",", notes) if g.strip()]:
            alts, prep = [], pending_prep
            pending_prep = ""
            texts = re.split(r"\s+or\s+", group, flags=re.I)
            for alt in texts:
                nid = self.match_product(alt)
                if nid:
                    alts.append(nid)
                    prep = prep or self.infusion(alt)
                elif "infused" in fold(alt):
                    pending_prep = self.infusion(alt) or fold(alt)
                elif re.search(r"\bor\b", group, re.I):
                    alts.append(fallback)  # "Cointreau or other orange liqueur"
                else:
                    unmatched.append(alt.strip())
            if alts:
                reqs.append((alts, prep, self.named_bottles(texts, alts)))
        if not reqs:
            return [([fallback], self.infusion(notes), self.named_bottles([notes, *re.split(r"\s+or\s+", notes, flags=re.I)], [fallback]))], False
        if unmatched:
            # some products matched and some didn't: dropping the rest would silently
            # remove a required bottle, so make someone add a products.csv rule
            self.problems.append(f"products: no rule for {unmatched} in notes {notes!r}")
        if pending_prep:
            self.problems.append(f"products: infusion {pending_prep!r} not followed by a product in {notes!r}")
        if groups_are_alternatives:
            return [([a for alts, _, _ in reqs for a in alts], "", [b for _, _, bs in reqs for b in bs])], True
        return reqs, True

    def resolve(self, raw_ingredient, notes):
        """Returns a list of requirements {anyOf, with, prep, suggest}, [] to skip the
        line, or None if the source string is unmapped."""
        key = normalize_ingredient(raw_ingredient)
        if key not in self.aliases:
            return None
        spec, prep, suggest = self.aliases[key]
        if spec == "-":
            return []
        if spec.startswith("@notes:") or spec.startswith("@any:"):
            mode, fallback = spec[1:].split(":", 1)
            base, *quals = fallback.split("&")
            reqs, matched = self.from_notes(notes, base, mode == "any")
            if matched:
                # the bottle's class replaces the coarse label; keep only real qualifiers
                quals = [q for q in [base, *quals] if q in self.qualifiers]
                suggest = []
            reqs = [(alts, p, quals, bottles) for alts, p, bottles in reqs]
        else:
            prep = prep or self.infusion(notes)
            parts = spec.split("+")
            # a note can only name the bottle for a single-part line
            heads = parts[0].split("&")[0].split("|")
            bottles = self.named_bottles([notes, *re.split(r"\s+or\s+", notes, flags=re.I)], heads) if len(parts) == 1 else []
            reqs = []
            for part in parts:
                head, *quals = part.split("&")
                reqs.append((head.split("|"), prep, quals, bottles))
        out = []
        known = self.tax.nodes
        for alts, p, quals, bottles in reqs:
            # unknown ids were already reported as problems; skip them rather than crash
            alts = self.tax.simplify([a for a in alts if a in known])
            quals = [q for q in quals if q in known]
            if not alts:
                continue
            if any(self.tax.nodes[a]["section"] == "rum" for a in alts):
                quals = quals + [n for rx, n in ORIGIN_IN_NOTE if rx.search(fold(notes))]
            # drop qualifiers the requirement already implies (black blended overproof is overproof)
            quals = [q for q in dict.fromkeys(quals) if not all(q in self.tax.ancestors(a) for a in alts)]
            out.append({"anyOf": alts, "with": quals, "prep": p, "suggest": suggest, "bottles": bottles})
        return out


def load_substitutes(tax, rows):
    """Expand substitutes.csv into one-directional {need, use, note} edges."""
    edges, problems = [], []
    for r in rows:
        need, use, direction = (r[k].strip() for k in ("need", "use", "direction"))
        bad = [n for n in (need, use) if n not in tax.nodes]
        if bad:
            problems.append(f"substitutes: unknown node(s) {bad}")
            continue
        if direction not in ("both", "one-way"):
            problems.append(f"substitutes: {need}/{use} has bad direction {direction!r}")
            continue
        pairs = [(need, use)] + ([(use, need)] if direction == "both" else [])
        for n, u in pairs:
            if n in tax.ancestors(u):
                # owning `u` already satisfies `n` through the hierarchy
                problems.append(f"substitutes: {u} -> {n} is redundant with taxonomy.csv")
                continue
            edges.append({"need": n, "use": u, "note": r["note"].strip()})
    keys = Counter((e["need"], e["use"]) for e in edges)
    problems += [f"substitutes: {n} <- {u} listed twice" for (n, u), c in keys.items() if c > 1]
    return edges, problems


def load_bottles(tax, resolver, rows):
    """Searchable bottles. Each must map to real nodes, and must satisfy whatever
    products.csv derives from its own name, or picking "Appleton" in the app wouldn't
    satisfy a recipe whose book names Appleton."""
    bottles, problems, seen = [], [], set()
    for r in rows:
        name = r["name"].strip()
        nodes = [n for n in r["node"].strip().split("+") if n]
        aliases = [a.strip() for a in r["aliases"].split("|") if a.strip()]
        bid = slug(name)
        if bid in seen:
            problems.append(f"bottles: {name!r} listed twice")
            continue
        seen.add(bid)
        bad = [n for n in nodes if n not in tax.nodes]
        if bad or not nodes:
            problems.append(f"bottles: {name!r} has unknown node(s) {bad or nodes}")
            continue
        covers = set().union(*(tax.ancestors(n) for n in nodes))
        for label in [name, *aliases]:
            derived = resolver.match_product(label)
            if derived and derived not in covers:
                problems.append(f"bottles: {label!r} -> {nodes}, but products.csv reads that name as {derived}")
        bottles.append({"id": bid, "name": name, "nodes": nodes, "aliases": aliases})
    # a renamed bottle should be one row with its old name as an alias, not two rows
    names = {b["id"]: b["name"] for b in bottles}
    for b in bottles:
        for a in b["aliases"]:
            other = names.get(slug(a))
            if other and slug(a) != b["id"]:
                problems.append(f"bottles: {other!r} is also listed as an alias of {b['name']!r}; merge them")
    return bottles, problems


APP_CATALOG = ROOT / "public" / "catalog"


def write_app_catalog(catalog):
    """Split the catalog for the web app: one core file plus one file per book, so the
    client loads (and later, is entitled to) only the books it needs."""
    compact = dict(ensure_ascii=False, separators=(",", ":"))
    books_dir = APP_CATALOG / "books"
    books_dir.mkdir(parents=True, exist_ok=True)
    for stale in books_dir.glob("*.json"):
        stale.unlink()
    for book in catalog["books"]:
        recipes = [{k: v for k, v in r.items() if k != "book"}
                   for r in catalog["recipes"] if r["book"] == book["id"]]
        (books_dir / f"{book['id']}.json").write_text(json.dumps(recipes, **compact))
    core = {k: catalog[k] for k in ("books", "taxonomy", "substitutes", "bottles")}
    (APP_CATALOG / "core.json").write_text(json.dumps(core, **compact))


def build():
    tax = Taxonomy(read_csv(DATA / "taxonomy.csv"))
    substitutes, sub_problems = load_substitutes(tax, read_csv(DATA / "substitutes.csv"))
    bottle_rows = read_csv(DATA / "bottles.csv")
    resolver = Resolver(tax, read_csv(DATA / "aliases.csv"), read_csv(DATA / "products.csv"), bottle_rows)
    bottles, bottle_problems = load_bottles(tax, resolver, bottle_rows)
    books = read_csv(DATA / "books.csv")

    warnings = []
    unmapped = Counter()
    recipes = []
    for book in books:
        rows = read_csv(DATA / "sources" / book["source"], comments=False, delimiter="\t")
        grouped = defaultdict(list)
        for r in rows:
            grouped[smart_title(r["name"])].append(r)
        for name, rs in grouped.items():
            # a recipe's rows should share one page; take the most common one so a
            # blank or mistyped page on a single row can't split the recipe in two
            pages = Counter(p for p in ((r.get("page") or "").strip() for r in rs) if p)
            page = pages.most_common(1)[0][0] if pages else ""
            if len(pages) > 1:
                warnings.append(f"{book['id']} {name!r}: rows disagree on page {dict(pages)}, using {page}")
            ingredients = []
            for r in rs:
                notes = (r.get("notes") or "").strip()
                resolved = resolver.resolve(r["ingredient"], notes)
                if resolved is None:
                    unmapped[(normalize_ingredient(r["ingredient"]), book["id"])] += 1
                    continue
                for req in resolved:
                    ing = {"anyOf": req["anyOf"], "source": smart_title(r["ingredient"].strip())}
                    if req["with"]:
                        ing["with"] = req["with"]
                    if notes:
                        ing["note"] = smart_title(notes)
                    if req["prep"]:
                        ing["prep"] = req["prep"]
                    if req["suggest"]:
                        ing["suggest"] = req["suggest"]
                    if req["bottles"]:
                        ing["bottles"] = req["bottles"]
                    ingredients.append(ing)
            recipes.append({
                "id": f"{book['id']}:{slug(name)}" + (f":{page}" if page else ""),
                "name": name,
                "book": book["id"],
                "page": int(page) if page.isdigit() else (page or None),
                "ingredients": ingredients,
            })

    problems = resolver.problems + sub_problems + bottle_problems
    for (raw, book_id), n in sorted(unmapped.items()):
        problems.append(f"unmapped: {raw!r} ({book_id}, {n} rows) -> add to data/aliases.csv")
    ids = Counter(r["id"] for r in recipes)
    problems += [f"duplicate recipe id {i}" for i, n in ids.items() if n > 1]

    used = {a for r in recipes for i in r["ingredients"] for a in [*i["anyOf"], *i.get("with", [])]}
    catalog = {
        "books": [{**{k: b[k] for k in ("id", "title", "short", "author", "year", "credit")},
                   "recipeCount": sum(1 for r in recipes if r["book"] == b["id"])}
                  for b in books],
        "taxonomy": list(tax.nodes.values()),
        "substitutes": substitutes,
        "bottles": bottles,
        "recipes": sorted(recipes, key=lambda r: (r["book"], fold(r["name"]))),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=1))
    if not problems:  # never ship a catalog with unmapped or dropped ingredients to the app
        write_app_catalog(catalog)

    print(f"{len(catalog['books'])} books, {len(recipes)} recipes, {len(bottles)} bottles, "
          f"{sum(len(r['ingredients']) for r in recipes)} ingredient lines, "
          f"{len(used)} of {len(tax.nodes)} taxonomy nodes used")
    for w in warnings:
        print("warning:", w, file=sys.stderr)
    for p in problems:
        print("PROBLEM:", p, file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(build())
