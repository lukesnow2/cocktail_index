## Cocktail Index

What you can make tonight from the cocktail books on your shelf and the bottles in your bar, with the book and page for each recipe. We index what goes in a drink, never amounts or method: those stay in the book.

### Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # engine and search tests
npm run data    # rebuild public/catalog from data/ (Python 3)
```

### How it fits together

- `data/` is the source of truth: the book indexes (`sources/`), the ingredient taxonomy, how each book's labels map onto it (`aliases.csv`, `products.csv`), the strict substitution list and the searchable bottle list. Rum is classed by Smuggler's Cove's production categories.
- `scripts/build_catalog.py` checks all of it and writes `public/catalog/`, which the app loads. It refuses to write the app catalog while anything is unmapped or inconsistent.
- `lib/engine/` is the matching engine, plain TypeScript with no React.
- `app/` and `components/` are the Next.js app, built from the Cocktail Index design system.
- `legacy/` is the original 2017 app this grew from.

### Credits

Built on [pdt-index](https://github.com/thomaswford/pdt-index) by Thomas Ford. The original book indexes came from r/cocktails volunteers ThePaternalDrunk, el_joker1, openequalsheavier and rebeldragonlol.

Not affiliated with any book, author, publisher or bar.
