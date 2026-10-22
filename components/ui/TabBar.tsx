"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarIcon, BooksIcon, BuyIcon, DrinksIcon } from "./icons";

export type TabId = "drinks" | "bar" | "buy" | "books";

const ITEMS: { id: TabId; href: string; label: string; Icon: typeof DrinksIcon }[] = [
  { id: "drinks", href: "/", label: "Drinks", Icon: DrinksIcon },
  { id: "bar", href: "/bar", label: "My Bar", Icon: BarIcon },
  { id: "buy", href: "/buy", label: "Buy Next", Icon: BuyIcon },
  { id: "books", href: "/books", label: "Books", Icon: BooksIcon },
];

/** Which tab a path belongs to; a drink page keeps Drinks current. */
export function currentTab(pathname: string): TabId {
  if (pathname.startsWith("/bar")) return "bar";
  if (pathname.startsWith("/buy")) return "buy";
  if (pathname.startsWith("/books")) return "books";
  return "drinks";
}

export function TabBar({ current }: { current?: TabId }) {
  const pathname = usePathname();
  const active = current ?? currentTab(pathname);
  return (
    <nav className="ci-tabbar" aria-label="Main">
      {ITEMS.map(({ id, href, label, Icon }) => (
        <Link key={id} href={href} aria-current={active === id ? "page" : undefined}>
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
