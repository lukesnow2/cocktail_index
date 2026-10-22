import Link from "next/link";
import { SwapBadge } from "./SwapBadge";

/** One drink in a list; the whole row links to its drink page. A row with no note is ready. */
export function DrinkRow({
  href,
  name,
  book,
  page,
  ingredients,
  swap,
  missing,
}: {
  href: string;
  name: string;
  book: string;
  page: number | string | null;
  ingredients: string[];
  swap?: string;
  missing?: string;
}) {
  return (
    <li>
      <Link className="ci-row-link" href={href}>
        <span className="ci-row-top">
          <span className="ci-row-name row-title">{name}</span>
          <span className="ci-row-ref">
            {book}
            {page != null && <span> p.{page}</span>}
          </span>
        </span>
        <span className="ci-row-ings secondary">{ingredients.join(", ")}</span>
        {swap && (
          <span className="ci-row-swap">
            <SwapBadge />
            {swap}
          </span>
        )}
        {missing && <span className="ci-row-missing">Missing: {missing}</span>}
      </Link>
    </li>
  );
}
