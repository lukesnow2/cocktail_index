import Link from "next/link";

/** Where to find the drink: book, author and year, the page large, and other owned books with it. */
export function SourceBox({
  book,
  page,
  alsoIn,
}: {
  book: { title: string; author: string; year: string };
  page: number | string | null;
  alsoIn: { book: string; page: number | string | null; href: string }[];
}) {
  return (
    <div>
      <section className="ci-source" aria-label="Where to find it">
        <div className="ci-source-book">
          <span className="ci-source-label">FIND IT IN</span>
          <span className="item">{book.title}</span>
          <span className="caption text-muted">
            {book.author}, {book.year}
          </span>
        </div>
        <div className="ci-source-page">
          <span className="ci-source-label">PAGE</span>
          <span className="page-number">{page ?? "None"}</span>
        </div>
        {alsoIn.map((a) => (
          <Link key={a.href} className="ci-source-also" href={a.href}>
            Also in {a.book}
            {a.page != null && <span className="ref">p.{a.page}</span>}
          </Link>
        ))}
      </section>
      <p className="ci-source-note">Amounts and method are in the book. We only index what goes in.</p>
    </div>
  );
}
